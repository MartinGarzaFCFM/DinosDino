import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Entity, ICombatTarget, IDebuggable, IObstacleQuery } from '../Entity.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';
import { EventBus, IEventBus } from '../../core/EventBus.ts';
import { REXY_CONFIG } from '../../config/GameBalance.ts';

export type RexyAIState = 'CHASING' | 'SPRINTING' | 'RECOVERING';

export class Rexy extends Entity implements IDebuggable {
  private readonly bus: IEventBus;
  private readonly loader: IAssetLoader;
  private readonly debugRangeGroup: THREE.Group = new THREE.Group();

  private visualMesh?: THREE.Object3D;
  private mixer?: THREE.AnimationMixer;
  private walkAction?: THREE.AnimationAction;
  private target?: ICombatTarget;
  private environment?: IObstacleQuery;
  private terrain?: {
    getHeightAt(x: number, z: number): number;
    isHazardAt?(x: number, z: number): boolean;
  };

  public readonly position: THREE.Vector3 = new THREE.Vector3();
  public speed: number;
  public baseSpeed: number;
  private lastAttackTime: number = 0;

  // Live tuning parameters
  public sprintMultiplier: number = REXY_CONFIG.sprintMultiplier;
  public sprintCooldown: number = REXY_CONFIG.sprintCooldown;
  public sprintTriggerDistance: number = REXY_CONFIG.sprintTriggerDistance;
  public roarCooldown: number = REXY_CONFIG.roarCooldown;
  public roarStunDuration: number = REXY_CONFIG.roarStunDuration;
  public postAttackRecoveryDuration: number = REXY_CONFIG.postAttackRecoveryDuration;
  public isAIFrozen: boolean = false;

  // AI State & Timers
  public aiState: RexyAIState = 'CHASING';
  public isCastingRoar: boolean = false;
  public roarCastTimer: number = 0;
  public roarCastDuration: number = REXY_CONFIG.roarCastDuration;
  private sprintTimer: number = 0;
  private sprintCooldownTimer: number = 6.0; // Opening window for player to accelerate
  private roarCooldownTimer: number = REXY_CONFIG.roarInitialWarmup; // 12s buffer before first roar
  private recoveryTimer: number = 0;
  private postAttackTimer: number = 0;
  public isEnraged: boolean = false;

  // Visual debug mesh references
  private touchRingMat?: THREE.MeshBasicMaterial;
  private attackRingMat?: THREE.MeshBasicMaterial;

  // Reusable scratch vectors for zero per-frame GC pressure
  private readonly scratchTargetDir = new THREE.Vector3();
  private readonly scratchHitDir = new THREE.Vector3();
  private readonly scratchTargetVel = new THREE.Vector3();
  private readonly scratchAimPoint = new THREE.Vector3();
  private readonly scratchWhisker = new THREE.Vector3();

  constructor(
    id: string,
    spawnPos: THREE.Vector3,
    initialSpeed: number,
    bus: IEventBus = EventBus.getInstance(),
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    super(id);
    this.bus = bus;
    this.loader = loader;
    this.position.copy(spawnPos);
    this.speed = initialSpeed;
    this.baseSpeed = initialSpeed;
    this.group.position.copy(this.position);

    this.buildDebugRings();
  }

  public setBaseSpeed(newSpeed: number): void {
    const diff = newSpeed - this.baseSpeed;
    this.baseSpeed = newSpeed;
    this.speed = Math.max(REXY_CONFIG.minSpeed, this.speed + diff);
  }

  public get effectiveSpeed(): number {
    let current = this.speed;
    if (this.isEnraged) {
      current *= REXY_CONFIG.enragedSpeedMultiplier;
    }

    if (this.isCastingRoar) {
      // Slow down to plant stance for acoustic shockwave
      return current * 0.42;
    }

    // Environmental terrain hindrance: Rexy also bogs down when wading through deep mud
    if (this.terrain?.isHazardAt?.(this.position.x, this.position.z)) {
      current *= 0.65;
    }

    if (this.aiState === 'SPRINTING') {
      const sprintMult = this.isEnraged
        ? this.sprintMultiplier * 1.15
        : this.sprintMultiplier;
      return current * sprintMult;
    }
    if (this.aiState === 'RECOVERING') {
      return this.baseSpeed * REXY_CONFIG.exhaustionSpeedMultiplier;
    }
    return current;
  }

  public get distanceToTarget(): number {
    return this.target ? Math.round(this.position.distanceTo(this.target.position) * 10) / 10 : 0;
  }

  public get sprintRemaining(): number {
    return Math.max(0, Math.round(this.sprintTimer * 10) / 10);
  }

  public get cooldownRemaining(): number {
    return Math.max(0, Math.round(this.sprintCooldownTimer * 10) / 10);
  }

  public get roarRemaining(): number {
    return Math.max(0, Math.round(this.roarCooldownTimer * 10) / 10);
  }

  public get recoveryRemaining(): number {
    return Math.max(0, Math.round(this.recoveryTimer * 10) / 10);
  }

  public get postAttackRemaining(): number {
    return Math.max(0, Math.round(this.postAttackTimer * 10) / 10);
  }

  private buildDebugRings(): void {
    this.debugRangeGroup.visible = false;

    // Inner ring: Physical body shove radius; Outer ring: Lunge attack range
    const touchRingGeo = new THREE.RingGeometry(
      REXY_CONFIG.bodyTouchRadius - 0.3,
      REXY_CONFIG.bodyTouchRadius,
      36
    );
    touchRingGeo.rotateX(-Math.PI / 2);
    touchRingGeo.translate(0, 0.25, 0);
    this.touchRingMat = new THREE.MeshBasicMaterial({ color: 0xff3300, side: THREE.DoubleSide });
    const touchRing = new THREE.Mesh(touchRingGeo, this.touchRingMat);
    touchRing.userData.ignoreDebugWireframe = true;

    const attackRingGeo = new THREE.RingGeometry(
      REXY_CONFIG.attackRange - 0.3,
      REXY_CONFIG.attackRange,
      48
    );
    attackRingGeo.rotateX(-Math.PI / 2);
    attackRingGeo.translate(0, 0.25, 0);
    this.attackRingMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide });
    const attackRing = new THREE.Mesh(attackRingGeo, this.attackRingMat);
    attackRing.userData.ignoreDebugWireframe = true;

    this.debugRangeGroup.add(touchRing, attackRing);
    this.group.add(this.debugRangeGroup);
  }

  public setTarget(target?: ICombatTarget): void {
    this.target = target;
  }

  public setEnvironment(environment?: IObstacleQuery): void {
    this.environment = environment;
  }

  public setTerrain(terrain?: {
    getHeightAt(x: number, z: number): number;
    isHazardAt?(x: number, z: number): boolean;
  }): void {
    this.terrain = terrain;
  }

  public setEnraged(enraged: boolean): void {
    if (this.isEnraged === enraged) return;
    this.isEnraged = enraged;
    if (enraged) {
      this.roarCooldownTimer = 1.0;   // Unleash roar almost immediately when enraged
      this.sprintCooldownTimer = 0.8; // Trigger rapid sprint burst
    }
  }

  public async loadModel(): Promise<void> {
    try {
      const gltf = await this.loader.loadGLTF(REXY_CONFIG.modelUrl);

      // SkeletonUtils.clone properly rebinds SkinnedMesh bones to the cloned skeleton
      this.visualMesh = SkeletonUtils.clone(gltf.scene);
      const s = REXY_CONFIG.scale;
      this.visualMesh.scale.set(s, s, s);

      this.visualMesh.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          node.castShadow = true;
          node.receiveShadow = false;
        }
      });

      this.group.add(this.visualMesh);

      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.visualMesh);
        const clip =
          THREE.AnimationClip.findByName(gltf.animations, REXY_CONFIG.animationClipName) ||
          gltf.animations[0];
        this.walkAction = this.mixer.clipAction(clip);
        this.walkAction.play();
      }
    } catch (e) {
      console.error('Failed to load Rexy model:', e);
      const fallbackGeo = new THREE.ConeGeometry(5, 15, 8);
      const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x228833 });
      this.visualMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
      this.visualMesh.position.y = 7.5;
      this.group.add(this.visualMesh);
    }
  }

  public slowDown(amount: number = 4.0): void {
    this.speed = Math.max(REXY_CONFIG.minSpeed, this.speed - amount);
    this.bus.emit('rexy_slowed', { speed: this.effectiveSpeed });
  }

  public setWireframeDebug(visible: boolean): void {
    this.debugRangeGroup.visible = visible;
  }

  public setAIFrozen(frozen: boolean): void {
    this.isAIFrozen = frozen;
    if (frozen && this.mixer) {
      this.mixer.timeScale = 0;
    }
  }

  public update(delta: number): void {
    if (!this.target || this.isAIFrozen) return;

    // Post-attack recovery window: Rexy pauses pursuit after landing a hit ("roar of triumph")
    if (this.postAttackTimer > 0) {
      this.postAttackTimer -= delta;
      if (this.postAttackTimer <= 0) {
        this.postAttackTimer = 0;
      }
      if (this.mixer) {
        this.mixer.timeScale = 0.35;
        this.mixer.update(delta);
      }
      this.group.position.copy(this.position);
      return;
    }

    const targetPos = this.target.position;
    const distToTarget = this.position.distanceTo(targetPos);

    // 1. Apex Predator State Machine & Roar Timers
    this.updateAIState(delta, distToTarget);

    // 2. Compute effective movement speed based on current AI state & enraged status
    const currentSpeed = this.effectiveSpeed;

    // 3. Update animation mixer with rate matching current locomotion
    if (this.mixer) {
      const animRate = (currentSpeed / this.baseSpeed) * 1.35;
      this.mixer.timeScale = animRate;
      this.mixer.update(delta);
    }

    if (distToTarget <= REXY_CONFIG.detectionRange) {
      // 4. Predictive Interception (Target Leading)
      this.target.getVelocity(this.scratchTargetVel);
      this.scratchTargetVel.y = 0;
      const targetSpeed = this.scratchTargetVel.length();

      const closingSpeed = Math.max(8, currentSpeed + targetSpeed);
      const leadTime = THREE.MathUtils.clamp(
        distToTarget / closingSpeed,
        REXY_CONFIG.leadTimeMin,
        REXY_CONFIG.leadTimeMax
      );

      // Aim ahead along target trajectory
      this.scratchAimPoint.copy(targetPos).addScaledVector(this.scratchTargetVel, leadTime);
      this.scratchTargetDir.subVectors(this.scratchAimPoint, this.position);
      this.scratchTargetDir.y = 0;

      if (this.scratchTargetDir.lengthSq() > 0.0001) {
        this.scratchTargetDir.normalize();

        // 5. Raycast Whisker Obstacle Steering Avoidance
        this.applyWhiskerObstacleAvoidance();

        // Shortest-arc angular interpolation around Y-axis
        const targetAngle = Math.atan2(this.scratchTargetDir.x, this.scratchTargetDir.z);
        let angleDiff = targetAngle - this.group.rotation.y;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.group.rotation.y += angleDiff * Math.min(1, delta * REXY_CONFIG.turnLerpSpeed);

        // Advance along terrain
        const step = currentSpeed * delta;
        this.position.x += this.scratchTargetDir.x * step;
        this.position.z += this.scratchTargetDir.z * step;
        this.position.y = this.terrain ? this.terrain.getHeightAt(this.position.x, this.position.z) : 0;
      }

      // 6. Contact & Lunge Evaluation
      if (distToTarget < REXY_CONFIG.attackRange) {
        this.evaluateContact(this.target, distToTarget);
      }
    }

    this.group.position.copy(this.position);
  }

  private updateAIState(delta: number, distToTarget: number): void {
    // 1. Distant Pursuit Alpha Roar Check with FFXIV/WoW style Cast Telegraph
    if (this.isCastingRoar) {
      this.roarCastTimer += delta;
      const progress = Math.min(1.0, this.roarCastTimer / this.roarCastDuration);
      this.bus.emit('rexy_roar_cast_progress', {
        elapsed: this.roarCastTimer,
        duration: this.roarCastDuration,
        progress,
        shockwaveRadius: REXY_CONFIG.roarShockwaveRadius,
        rexyPos: this.position,
        distToPlayer: distToTarget
      });

      if (this.roarCastTimer >= this.roarCastDuration) {
        this.isCastingRoar = false;
        this.triggerDistantRoar(distToTarget);
      }
    } else if (this.roarCooldownTimer > 0) {
      this.roarCooldownTimer -= delta;
    } else if (
      distToTarget >= REXY_CONFIG.roarMinDistance &&
      distToTarget <= REXY_CONFIG.roarMaxDistance
    ) {
      // Start Roar Windup Cast
      this.isCastingRoar = true;
      this.roarCastTimer = 0;
      this.bus.emit('rexy_roar_cast_started', {
        duration: this.roarCastDuration,
        shockwaveRadius: REXY_CONFIG.roarShockwaveRadius,
        rexyPos: this.position.clone()
      });
    }

    // 2. Sprint burst state transitions
    if (this.aiState === 'SPRINTING') {
      this.sprintTimer -= delta;
      if (this.sprintTimer <= 0) {
        // Transition to recovery exhaustion
        this.aiState = 'RECOVERING';
        this.recoveryTimer = REXY_CONFIG.exhaustionDuration;
        const cooldown = this.isEnraged
          ? this.sprintCooldown * 0.5
          : this.sprintCooldown;
        this.sprintCooldownTimer = cooldown;
        this.bus.emit('rexy_state_changed', { state: this.aiState });
        this.updateDebugColors(0x555555, 0x888888);
      }
    } else if (this.aiState === 'RECOVERING') {
      this.recoveryTimer -= delta;
      if (this.recoveryTimer <= 0) {
        // Recovery complete, return to chasing
        this.aiState = 'CHASING';
        this.bus.emit('rexy_state_changed', { state: this.aiState });
        this.updateDebugColors(0xff3300, 0xffaa00);
      }
    } else {
      // 'CHASING' state: tick sprint cooldown down
      if (this.sprintCooldownTimer > 0) {
        this.sprintCooldownTimer -= delta;
      }

      // Check sprint burst trigger
      if (
        this.sprintCooldownTimer <= 0 &&
        distToTarget <= this.sprintTriggerDistance
      ) {
        this.triggerSprintLunge();
      }
    }
  }

  private triggerDistantRoar(distToTarget: number): void {
    const cooldown = this.isEnraged
      ? Math.max(5, this.roarCooldown * 0.6)
      : this.roarCooldown;
    this.roarCooldownTimer = cooldown;

    // Ground-shaking roar event
    this.bus.emit('rexy_roar', {
      position: this.position.clone(),
      shockwaveRadius: REXY_CONFIG.roarShockwaveRadius
    });

    // Check if player escaped the blast radius!
    if (distToTarget <= REXY_CONFIG.roarShockwaveRadius) {
      if (this.target?.applyStun) {
        this.target.applyStun(this.roarStunDuration);
      }
      this.bus.emit('rexy_roar_hit', { distance: distToTarget });
    } else {
      // Player successfully escaped outside the shockwave blast!
      this.bus.emit('rexy_roar_escaped', {
        distance: distToTarget,
        radius: REXY_CONFIG.roarShockwaveRadius
      });
    }
  }

  private triggerSprintLunge(): void {
    this.aiState = 'SPRINTING';
    this.sprintTimer = REXY_CONFIG.sprintDuration;
    this.bus.emit('rexy_state_changed', { state: this.aiState });
    this.updateDebugColors(0xff0000, 0xff2200);
  }

  private updateDebugColors(touchColor: number, attackColor: number): void {
    if (this.touchRingMat) this.touchRingMat.color.setHex(touchColor);
    if (this.attackRingMat) this.attackRingMat.color.setHex(attackColor);
  }

  private applyWhiskerObstacleAvoidance(): void {
    if (!this.environment) return;

    const fwdDist = REXY_CONFIG.whiskerDistance;
    this.scratchWhisker.copy(this.position).addScaledVector(this.scratchTargetDir, fwdDist);

    // If center path hits a building collider, check left & right angles to steer around
    if (!this.environment.isPositionClear(this.scratchWhisker, 10)) {
      const angle = REXY_CONFIG.whiskerAngle;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Left whisker (+angle)
      const lx = this.scratchTargetDir.x * cosA - this.scratchTargetDir.z * sinA;
      const lz = this.scratchTargetDir.x * sinA + this.scratchTargetDir.z * cosA;
      this.scratchWhisker.set(
        this.position.x + lx * fwdDist * 0.85,
        0,
        this.position.z + lz * fwdDist * 0.85
      );
      const leftClear = this.environment.isPositionClear(this.scratchWhisker, 10);

      // Right whisker (-angle)
      const rx = this.scratchTargetDir.x * cosA + this.scratchTargetDir.z * sinA;
      const rz = -this.scratchTargetDir.x * sinA + this.scratchTargetDir.z * cosA;
      this.scratchWhisker.set(
        this.position.x + rx * fwdDist * 0.85,
        0,
        this.position.z + rz * fwdDist * 0.85
      );
      const rightClear = this.environment.isPositionClear(this.scratchWhisker, 10);

      if (leftClear && !rightClear) {
        this.scratchTargetDir.set(lx, 0, lz).normalize();
      } else if (rightClear && !leftClear) {
        this.scratchTargetDir.set(rx, 0, rz).normalize();
      } else if (leftClear && rightClear) {
        this.scratchTargetDir.set(lx, 0, lz).normalize();
      }
    }
  }

  private evaluateContact(target: ICombatTarget, distToTarget: number): void {
    const now = performance.now() / 1000;

    this.scratchHitDir.subVectors(target.position, this.position).normalize();
    this.scratchHitDir.y = REXY_CONFIG.hitUpwardBias;
    this.scratchHitDir.normalize();

    // 1. Attack Cooldown Ready: Trigger full damage and explosive launch
    if (now - this.lastAttackTime >= REXY_CONFIG.attackCooldown && this.postAttackTimer <= 0) {
      this.lastAttackTime = now;
      this.postAttackTimer = this.postAttackRecoveryDuration;
      target.takeRexyHit(1, this.scratchHitDir);
      this.bus.emit('rexy_attack', {
        position: this.position.clone(),
        direction: this.scratchHitDir.clone()
      });

      // After a successful landing hit, enter post-attack recovery
      if (this.aiState === 'SPRINTING') {
        this.aiState = 'RECOVERING';
        this.recoveryTimer = Math.max(this.recoveryTimer, this.postAttackRecoveryDuration);
        this.bus.emit('rexy_state_changed', { state: this.aiState });
      }
      return;
    }

    // 2. Continuous Physical Touch Collision while on cooldown
    // Suppress body push during post-attack recovery window so player can escape cleanly
    if (distToTarget < REXY_CONFIG.bodyTouchRadius && this.postAttackTimer <= 0) {
      target.pushFromRexy(this.scratchHitDir, REXY_CONFIG.bodyShoveStrength);
    }
  }

  public override destroy(): void {
    super.destroy();
    if (this.mixer && this.visualMesh) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.visualMesh);
    }
  }
}
