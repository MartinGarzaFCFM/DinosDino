import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Entity, ICombatTarget, IDebuggable } from '../Entity.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';
import { EventBus, IEventBus } from '../../core/EventBus.ts';
import { REXY_CONFIG } from '../../config/GameBalance.ts';

export class Rexy extends Entity implements IDebuggable {
  private readonly bus: IEventBus;
  private readonly loader: IAssetLoader;
  private readonly debugRangeGroup: THREE.Group = new THREE.Group();

  private visualMesh?: THREE.Object3D;
  private mixer?: THREE.AnimationMixer;
  private walkAction?: THREE.AnimationAction;
  private target?: ICombatTarget;

  public readonly position: THREE.Vector3 = new THREE.Vector3();
  public speed: number;
  public readonly baseSpeed: number;
  private lastAttackTime: number = 0;

  // Reusable scratch vectors for zero per-frame GC pressure
  private readonly scratchTargetDir = new THREE.Vector3();
  private readonly scratchHitDir = new THREE.Vector3();

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
    const touchRing = new THREE.Mesh(
      touchRingGeo,
      new THREE.MeshBasicMaterial({ color: 0xff3300, side: THREE.DoubleSide })
    );
    touchRing.userData.ignoreDebugWireframe = true;

    const attackRingGeo = new THREE.RingGeometry(
      REXY_CONFIG.attackRange - 0.3,
      REXY_CONFIG.attackRange,
      48
    );
    attackRingGeo.rotateX(-Math.PI / 2);
    attackRingGeo.translate(0, 0.25, 0);
    const attackRing = new THREE.Mesh(
      attackRingGeo,
      new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide })
    );
    attackRing.userData.ignoreDebugWireframe = true;

    this.debugRangeGroup.add(touchRing, attackRing);
    this.group.add(this.debugRangeGroup);
  }

  public setTarget(target?: ICombatTarget): void {
    this.target = target;
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

  public slowDown(amount: number = 3.0): void {
    this.speed = Math.max(REXY_CONFIG.minSpeed, this.speed - amount);
    this.bus.emit('rexy_slowed', { speed: this.speed });
  }

  public setWireframeDebug(visible: boolean): void {
    this.debugRangeGroup.visible = visible;
  }

  public update(delta: number): void {
    if (this.mixer) {
      this.mixer.timeScale = (this.speed / this.baseSpeed) * 1.25;
      this.mixer.update(delta);
    }

    if (!this.target) return;

    const targetPos = this.target.position;
    const distToTarget = this.position.distanceTo(targetPos);

    if (distToTarget <= REXY_CONFIG.detectionRange) {
      this.scratchTargetDir.subVectors(targetPos, this.position);
      this.scratchTargetDir.y = 0;

      if (this.scratchTargetDir.lengthSq() > 0.0001) {
        this.scratchTargetDir.normalize();

        // Shortest-arc angular interpolation around Y-axis
        const targetAngle = Math.atan2(this.scratchTargetDir.x, this.scratchTargetDir.z);
        let angleDiff = targetAngle - this.group.rotation.y;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.group.rotation.y += angleDiff * Math.min(1, delta * REXY_CONFIG.turnLerpSpeed);

        // Advance along terrain
        const step = this.speed * delta;
        this.position.x += this.scratchTargetDir.x * step;
        this.position.z += this.scratchTargetDir.z * step;
        this.position.y = 0;
      }

      if (distToTarget < REXY_CONFIG.attackRange) {
        this.evaluateContact(this.target, distToTarget);
      }
    }

    this.group.position.copy(this.position);
  }

  private evaluateContact(target: ICombatTarget, distToTarget: number): void {
    const now = performance.now() / 1000;

    this.scratchHitDir.subVectors(target.position, this.position).normalize();
    this.scratchHitDir.y = REXY_CONFIG.hitUpwardBias;
    this.scratchHitDir.normalize();

    // 1. Attack Cooldown Ready: Trigger full damage and explosive launch
    if (now - this.lastAttackTime >= REXY_CONFIG.attackCooldown) {
      this.lastAttackTime = now;
      target.takeRexyHit(1, this.scratchHitDir);
      this.bus.emit('rexy_attack', {
        position: this.position.clone(),
        direction: this.scratchHitDir.clone()
      });
      return;
    }

    // 2. Continuous Physical Touch Collision while on cooldown
    if (distToTarget < REXY_CONFIG.bodyTouchRadius) {
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
