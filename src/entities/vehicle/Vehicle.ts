import * as THREE from 'three';
import { Entity, ICombatTarget, IDebuggable, IPickupTarget } from '../Entity.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';
import { InputState } from '../../input/InputManager.ts';
import { EventBus, IEventBus } from '../../core/EventBus.ts';
import { ARENA_CONFIG, PICKUP_DEFAULTS, VEHICLE_CONFIG } from '../../config/GameBalance.ts';
import { TerrainSurfaceInfo } from '../../physics/TerrainBody.ts';
import { createWireframeBox } from '../../graphics/GeometryUtils.ts';

export interface ITerrainQuery {
  getHeightAt(x: number, z: number): number;
  getNormalAt?(x: number, z: number, out: THREE.Vector3): THREE.Vector3;
}

export interface IObstacleResolver {
  resolveCollision?(pos: THREE.Vector3, radius?: number): boolean;
}

/**
 * Arcade Kinematic Driving Controller.
 * Delivers crisp, instant acceleration, 100% responsive handling,
 * smooth terrain hugging, and deterministic collision recovery without
 * raycast-spring or simulation bottom-out glitches.
 */
export class Vehicle extends Entity implements IPickupTarget, ICombatTarget, IDebuggable {
  public readonly position: THREE.Vector3 = new THREE.Vector3();
  public readonly quaternion: THREE.Quaternion = new THREE.Quaternion();

  private readonly bus: IEventBus;
  private readonly loader: IAssetLoader;
  private readonly debugWireframeMesh: THREE.LineSegments;
  private visualMesh?: THREE.Object3D;

  private terrain?: ITerrainQuery;
  private environment?: IObstacleResolver;

  // Stun and traction disruption mechanics
  private stunTimer: number = 0;
  private tractionDisruptTimer: number = 0;

  // Post-hit recovery & invulnerability
  private damageGraceTimer: number = 0;
  private adrenalineTimer: number = 0;
  public damageGraceDuration: number = VEHICLE_CONFIG.damageGraceDuration;
  public adrenalineTorqueMultiplier: number = VEHICLE_CONFIG.adrenalineTorqueMultiplier;

  // Core Arcade Driving Parameters
  public maxSpeedKmh: number = VEHICLE_CONFIG.maxSpeedKmh;
  public maxReverseSpeedKmh: number = VEHICLE_CONFIG.maxReverseSpeedKmh;
  public acceleration: number = VEHICLE_CONFIG.acceleration;
  public launchBoost: number = VEHICLE_CONFIG.launchBoost;
  public brakeDecel: number = VEHICLE_CONFIG.brakeDecel;
  public coastDecel: number = VEHICLE_CONFIG.coastDecel;
  public turnSpeed: number = VEHICLE_CONFIG.turnSpeed;
  public driftGrip: number = VEHICLE_CONFIG.driftGrip;
  public handbrakeGrip: number = VEHICLE_CONFIG.handbrakeGrip;
  public gravity: number = VEHICLE_CONFIG.gravity;

  // Health and bonuses
  public health: number = VEHICLE_CONFIG.maxHealth;
  public readonly maxHealth: number = VEHICLE_CONFIG.maxHealth;
  public bonusSpeed: number = 0; // Permanent top-speed bonus in km/h
  public currentSpeedKmh: number = 0;

  /** Effective top speed ceiling in m/s factoring in Speed Tire bonuses */
  public get topSpeedMs(): number {
    return (this.maxSpeedKmh + this.bonusSpeed) / 3.6;
  }

  // Real-time calculated effective acceleration for HUD/telemetry
  public get effectiveAcceleration(): number {
    let accel = this.acceleration;
    const speedRatio = Math.max(0, this.forwardSpeed) / this.topSpeedMs;
    if (speedRatio < 0.65) {
      const boostBlend = 1.0 - (speedRatio / 0.65);
      accel *= THREE.MathUtils.lerp(1.0, this.launchBoost, boostBlend);
    }
    if (this.adrenalineTimer > 0) {
      accel *= this.adrenalineTorqueMultiplier;
    }
    return accel;
  }

  // Motion state
  public heading: number = 0; // Yaw angle in radians (+Z is forward at 0)
  public forwardSpeed: number = 0; // Forward scalar velocity (m/s)
  public readonly horizontalVelocity: THREE.Vector3 = new THREE.Vector3();
  public verticalVelocity: number = 0;
  public isAirborne: boolean = false;
  private lastInputs?: Readonly<InputState>;

  // Scratch objects for zero per-frame GC allocations
  private readonly scratchFwd = new THREE.Vector3();
  private readonly scratchRight = new THREE.Vector3();
  private readonly scratchUpVec = new THREE.Vector3(0, 1, 0);
  private readonly scratchSlopeQuat = new THREE.Quaternion();
  private readonly scratchFlightPitchQuat = new THREE.Quaternion();
  private readonly scratchTargetQuat = new THREE.Quaternion();
  private readonly scratchNormal = new THREE.Vector3(0, 1, 0);
  private prevGroundY: number = -999;
  private wasInHazard: boolean = false;

  constructor(
    id: string,
    spawnPos: THREE.Vector3,
    bus: IEventBus = EventBus.getInstance(),
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    super(id);
    this.bus = bus;
    this.loader = loader;

    this.position.copy(spawnPos);
    this.group.position.copy(this.position);

    // Visual debug wireframe matching the chassis bounding box
    const { chassisSize } = VEHICLE_CONFIG;
    this.debugWireframeMesh = createWireframeBox(chassisSize, 0x00ffff);
    this.debugWireframeMesh.position.set(0, 0, 0);
    this.debugWireframeMesh.visible = false;
    this.group.add(this.debugWireframeMesh);
  }

  public setTerrain(terrain: ITerrainQuery): void {
    this.terrain = terrain;
  }

  public setEnvironment(environment: IObstacleResolver): void {
    this.environment = environment;
  }

  public get isInvulnerable(): boolean {
    return this.damageGraceTimer > 0;
  }

  public get invulnerabilityRemaining(): number {
    return Math.max(0, Math.round(this.damageGraceTimer * 10) / 10);
  }

  public get isAdrenalineActive(): boolean {
    return this.adrenalineTimer > 0;
  }

  public get adrenalineRemaining(): number {
    return Math.max(0, Math.round(this.adrenalineTimer * 10) / 10);
  }

  public get isStunned(): boolean {
    return this.stunTimer > 0;
  }

  public get stunRemaining(): number {
    return Math.max(0, Math.round(this.stunTimer * 10) / 10);
  }

  public get isTractionDisrupted(): boolean {
    return this.tractionDisruptTimer > 0;
  }

  public get tractionDisruptRemaining(): number {
    return Math.max(0, Math.round(this.tractionDisruptTimer * 10) / 10);
  }

  public applyStun(durationSeconds: number = 1.8): void {
    this.stunTimer = Math.max(this.stunTimer, durationSeconds);
    this.applyTractionDisruption(durationSeconds + 1.2);
    this.bus.emit('player_stunned', { duration: durationSeconds });
  }

  public applyTractionDisruption(durationSeconds: number = 2.5): void {
    this.tractionDisruptTimer = Math.max(this.tractionDisruptTimer, durationSeconds);
  }

  public async loadModel(): Promise<void> {
    try {
      const gltf = await this.loader.loadGLTF(VEHICLE_CONFIG.modelUrl);
      this.visualMesh = gltf.scene.clone();
      const s = VEHICLE_CONFIG.modelScale;
      this.visualMesh.scale.set(s, s, s);

      // Car model nose faces +X in raw GLTF; rotate +90 deg around Y so it faces +Z forward
      this.visualMesh.rotation.y = Math.PI / 2;
      this.visualMesh.position.set(0, -1.0, 0);

      this.visualMesh.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      this.group.add(this.visualMesh);
    } catch (e) {
      console.error('Failed to load vehicle model:', e);
      const { chassisSize } = VEHICLE_CONFIG;
      const fallbackGeo = new THREE.BoxGeometry(chassisSize.x, chassisSize.y, chassisSize.z);
      const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x00ccff, metalness: 0.3 });
      this.visualMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
      this.visualMesh.castShadow = true;
      this.group.add(this.visualMesh);
    }
  }

  public applyInputs(inputs: Readonly<InputState>): void {
    if (inputs.resetVehicle) {
      this.resetUpright();
      return;
    }
    this.lastInputs = inputs;
  }

  private processDrivingInputs(inputs: Readonly<InputState>, delta: number, surface?: Readonly<TerrainSurfaceInfo>): void {
    const baseTopSpeedMs = this.topSpeedMs;
    const reverseSpeedMs = this.maxReverseSpeedKmh / 3.6;

    // 1. If stunned by Rexy acoustic roar: engine is stalled
    if (this.stunTimer > 0) {
      this.forwardSpeed = Math.max(0, this.forwardSpeed - this.coastDecel * 2.5 * delta);
      return;
    }

    // 2. Terrain Hazard & Incline Evaluation
    let topSpeedMs = baseTopSpeedMs;
    let mudViscousDrag = 0;

    if (surface && surface.linearDamping > 0.2) {
      // Deep mud limits terminal speed ceiling by ~55-65%:
      const mudSeverity = THREE.MathUtils.clamp((surface.linearDamping - 0.15) / 0.5, 0.2, 1.0);
      topSpeedMs *= (1.0 - mudSeverity * 0.58); // Caps 260 km/h down to ~105-115 km/h!

      // Viscous hydrodynamic drag increases with velocity (speed squared resistance):
      const speedMs = Math.abs(this.forwardSpeed);
      mudViscousDrag = (18.0 + speedMs * 0.65) * mudSeverity;
    }

    // Incline grade resistance: driving uphill fights gravity, downhill accelerates
    const forwardIncline = -this.scratchNormal.dot(this.scratchFwd);
    const slopeGravityDecel = this.gravity * forwardIncline * 0.65;

    // 3. Throttle & Acceleration
    if (inputs.throttle > 0) {
      let accel = this.acceleration;

      // Punchy off-the-line launch torque curve:
      const speedRatio = Math.max(0, this.forwardSpeed) / baseTopSpeedMs;
      if (speedRatio < 0.65) {
        const boostBlend = 1.0 - (speedRatio / 0.65);
        accel *= THREE.MathUtils.lerp(1.0, this.launchBoost, boostBlend);
      }

      // Adrenaline breakaway surge after taking Rexy damage
      if (this.adrenalineTimer > 0) {
        accel *= this.adrenalineTorqueMultiplier;
      }

      // Net acceleration factoring in engine thrust, slope incline gravity, and viscous mud drag
      const netAccel = accel * inputs.throttle - slopeGravityDecel - mudViscousDrag;
      this.forwardSpeed += netAccel * delta;

      // If entering mud at hyper speed (> topSpeedMs), apply aggressive hydrodynamic deceleration
      if (this.forwardSpeed > topSpeedMs) {
        this.forwardSpeed = THREE.MathUtils.lerp(this.forwardSpeed, topSpeedMs, Math.min(1.0, 14.0 * delta));
      }
      this.forwardSpeed = Math.max(0, this.forwardSpeed);
    } else if (inputs.throttle < 0) {
      if (this.forwardSpeed > 1.2) {
        // Active braking
        this.forwardSpeed = Math.max(0, this.forwardSpeed - (this.brakeDecel + mudViscousDrag) * delta);
      } else {
        // Reverse
        this.forwardSpeed = Math.max(-reverseSpeedMs, this.forwardSpeed - (this.acceleration * 0.8 - mudViscousDrag) * delta);
      }
    } else {
      // Natural rolling resistance drag + viscous mud drag + slope gravity
      const totalDrag = this.coastDecel + mudViscousDrag + slopeGravityDecel;
      if (this.forwardSpeed > 0) {
        this.forwardSpeed = Math.max(0, this.forwardSpeed - totalDrag * delta);
      } else if (this.forwardSpeed < 0) {
        this.forwardSpeed = Math.min(0, this.forwardSpeed + totalDrag * delta);
      }
    }

    // 4. Handbrake / Footbrake
    if (inputs.brake) {
      if (this.forwardSpeed > 0) {
        this.forwardSpeed = Math.max(0, this.forwardSpeed - this.brakeDecel * 1.5 * delta);
      } else if (this.forwardSpeed < 0) {
        this.forwardSpeed = Math.min(0, this.forwardSpeed + this.brakeDecel * 1.5 * delta);
      }
    }

    // 5. Steering (Heading angle)
    // Dynamic steering curve: stable and weighted at hyper speeds, responsive at low speeds
    const speedRatio = Math.abs(this.forwardSpeed) / baseTopSpeedMs;
    const steerScale = speedRatio < 0.1
      ? Math.max(0.3, speedRatio * 7)
      : Math.max(0.38, 1.0 - speedRatio * 0.58);

    const steerDir = this.forwardSpeed < -0.5 ? -1 : 1;
    this.heading -= inputs.steering * this.turnSpeed * steerScale * steerDir * delta;
  }

  public update(delta: number, surface?: Readonly<TerrainSurfaceInfo>): void {
    // 0. Consume and process player driving inputs with true frame delta and surface context
    if (this.lastInputs) {
      this.processDrivingInputs(this.lastInputs, delta, surface);
    }

    // Hazard state transition & high-speed plunge impact
    const inHazard = !!surface?.isHazard;
    if (inHazard !== this.wasInHazard) {
      this.wasInHazard = inHazard;
      this.bus.emit('hazard_state_changed', {
        inHazard,
        name: surface?.zoneName || ''
      });

      // Impact jolt when plunging into deep mud at high velocity
      if (inHazard && Math.abs(this.forwardSpeed) > 20.0) {
        const mudImpact = THREE.MathUtils.clamp((Math.abs(this.forwardSpeed) / 70.0) * 0.45, 0.15, 0.5);
        this.bus.emit('camera_trauma', { amount: mudImpact });
      }
    }

    // 1. Tick Recovery & Stun Timers
    if (this.damageGraceTimer > 0) {
      this.damageGraceTimer = Math.max(0, this.damageGraceTimer - delta);
    }
    if (this.adrenalineTimer > 0) {
      this.adrenalineTimer = Math.max(0, this.adrenalineTimer - delta);
    }
    if (this.stunTimer > 0) {
      this.stunTimer -= delta;
      if (this.stunTimer <= 0) {
        this.stunTimer = 0;
        this.bus.emit('player_recovered');
      }
    }
    if (this.tractionDisruptTimer > 0) {
      this.tractionDisruptTimer = Math.max(0, this.tractionDisruptTimer - delta);
    }

    // 2. Compute Forward & Right Basis Vectors from Heading
    this.scratchFwd.set(Math.sin(this.heading), 0, Math.cos(this.heading)).normalize();
    this.scratchRight.set(Math.cos(this.heading), 0, -Math.sin(this.heading)).normalize();

    // 3. Horizontal Velocity & Lateral Drift
    if (this.isAirborne) {
      // In mid-air: maintain full ballistic knockback momentum without tire friction killing it
      this.horizontalVelocity.multiplyScalar(Math.max(0, 1.0 - 0.2 * delta));
      this.forwardSpeed = this.horizontalVelocity.dot(this.scratchFwd);
    } else {
      // On ground: decouple forward traction from lateral drift!
      // Forward velocity responds directly and crisply to forwardSpeed (accelerator/brakes)
      const currentForwardVel = this.horizontalVelocity.dot(this.scratchFwd);
      const currentLateralVel = this.horizontalVelocity.dot(this.scratchRight);

      // Instant forward traction: eliminates the mushy lag on throttle/brake:
      const forwardTractionRate = Math.min(1.0, 36.0 * delta);
      const newForwardVel = THREE.MathUtils.lerp(currentForwardVel, this.forwardSpeed, forwardTractionRate);

      // Lateral drift governed by driftGrip & high-speed weight inertia (power-sliding)
      const speedNorm = Math.abs(this.forwardSpeed) / this.topSpeedMs;
      let effectiveGrip = this.driftGrip;

      if (this.lastInputs?.handbrake) {
        effectiveGrip = this.handbrakeGrip;
      } else if (speedNorm > 0.35) {
        // High-speed weight inertia breaks lateral tire adhesion, creating a thrilling power-drift
        const highSpeedSlide = (speedNorm - 0.35) * 0.6;
        effectiveGrip = Math.max(3.0, effectiveGrip * (1.0 - highSpeedSlide));
      }

      if (this.isTractionDisrupted) {
        effectiveGrip *= 0.35;
      } else if (surface?.isHazard) {
        effectiveGrip *= 0.35; // Severe mud hydroplaning & tire slippage
      }

      const lateralTractionRate = Math.min(1.0, effectiveGrip * delta);
      const newLateralVel = THREE.MathUtils.lerp(currentLateralVel, 0, lateralTractionRate);

      // Reconstruct horizontal velocity vector
      this.horizontalVelocity.copy(this.scratchFwd).multiplyScalar(newForwardVel)
        .addScaledVector(this.scratchRight, newLateralVel);
    }

    // 4. Advance Position
    this.position.x += this.horizontalVelocity.x * delta;
    this.position.z += this.horizontalVelocity.z * delta;

    // 5. Arena Boundary Wall Clamping
    const bound = ARENA_CONFIG.arenaDriveBound;
    if (this.position.x > bound) {
      this.position.x = bound;
      this.horizontalVelocity.x *= -0.3;
      this.forwardSpeed *= 0.5;
    } else if (this.position.x < -bound) {
      this.position.x = -bound;
      this.horizontalVelocity.x *= -0.3;
      this.forwardSpeed *= 0.5;
    }

    if (this.position.z > bound) {
      this.position.z = bound;
      this.horizontalVelocity.z *= -0.3;
      this.forwardSpeed *= 0.5;
    } else if (this.position.z < -bound) {
      this.position.z = -bound;
      this.horizontalVelocity.z *= -0.3;
      this.forwardSpeed *= 0.5;
    }

    // 6. Obstacle Collision Resolution against Scenery Buildings
    if (this.environment?.resolveCollision) {
      const collided = this.environment.resolveCollision(this.position, 2.8);
      if (collided) {
        this.forwardSpeed *= 0.75;
      }
    }

    // 7. Terrain Height and Slope Alignment
    let rideHeight = VEHICLE_CONFIG.rideHeight;
    if (surface?.isHazard) {
      rideHeight -= 0.42; // Chassis visibly sinks deep into the mud muck!
    }
    let groundY = rideHeight;
    this.scratchNormal.set(0, 1, 0);

    if (this.terrain) {
      groundY = this.terrain.getHeightAt(this.position.x, this.position.z) + rideHeight;
      if (this.terrain.getNormalAt) {
        this.terrain.getNormalAt(this.position.x, this.position.z, this.scratchNormal);
      }
    }

    if (this.prevGroundY === -999) {
      this.prevGroundY = groundY;
    }

    // Rate of vertical change from terrain slope (m/s)
    const terrainSlopeSpeed = delta > 0.0001 ? (groundY - this.prevGroundY) / delta : 0;
    this.prevGroundY = groundY;

    // 8. Vertical Physics & Jump / Air-time Handling
    if (this.isAirborne) {
      this.verticalVelocity -= this.gravity * delta;
      this.position.y += this.verticalVelocity * delta;

      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this.isAirborne = false;

        // Heavy touchdown impact: emit camera trauma thud
        if (this.verticalVelocity < -8.0) {
          const impactTrauma = Math.min(0.5, Math.abs(this.verticalVelocity) * 0.025);
          this.bus.emit('camera_trauma', { amount: impactTrauma });
        }
        this.verticalVelocity = 0;
      }
    } else {
      // While grounded:
      // Driving up an incline pushes chassis upward, building vertical momentum
      if (terrainSlopeSpeed > 0) {
        this.verticalVelocity = Math.max(this.verticalVelocity, terrainSlopeSpeed);
      }

      // Crest launch detection:
      // If forward speed and upward momentum carry vehicle higher than the terrain,
      // it launches into the air with real ballistic projectile motion!
      const predictedY = this.position.y + this.verticalVelocity * delta;
      const jumpThreshold = groundY + 0.08;

      if (predictedY > jumpThreshold && (this.verticalVelocity > 2.5 || Math.abs(this.forwardSpeed) > 14.0)) {
        this.isAirborne = true;
        this.position.y = predictedY;
      } else {
        // Firm suspension clinging to terrain surface when driving normally
        this.position.y = THREE.MathUtils.lerp(this.position.y, groundY, Math.min(1.0, 38.0 * delta));
        // Decay upward momentum when grounded on flat/downhill
        this.verticalVelocity = Math.max(0, this.verticalVelocity - 24.0 * delta);
      }
    }

    // 9. Orientation Quaternion Calculation (Smooth Pitch, Roll, and Yaw)
    // Compose pure SO(3) rotation: first yaw around world Y, then tilt along terrain or flight vector
    this.scratchTargetQuat.setFromAxisAngle(this.scratchUpVec, this.heading);
    if (!this.isAirborne) {
      this.scratchSlopeQuat.setFromUnitVectors(this.scratchUpVec, this.scratchNormal);
      this.scratchTargetQuat.premultiply(this.scratchSlopeQuat);
    } else {
      // In mid-air: calculate flight velocity trajectory pitch so car points along its jump arc
      const flightSpeed = Math.sqrt(
        this.horizontalVelocity.x * this.horizontalVelocity.x +
        this.horizontalVelocity.z * this.horizontalVelocity.z
      );
      if (flightSpeed > 2.0) {
        const flightPitch = THREE.MathUtils.clamp(Math.atan2(this.verticalVelocity, flightSpeed), -0.55, 0.45);
        this.scratchFlightPitchQuat.setFromAxisAngle(this.scratchRight, -flightPitch);
        this.scratchTargetQuat.premultiply(this.scratchFlightPitchQuat);
      }
    }

    this.quaternion.slerp(this.scratchTargetQuat, Math.min(1, 18 * delta));

    // 10. Update Three.js Visual Scene Node
    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.quaternion);

    // 11. Accurate Speedometer reading in km/h
    const horizSpeedMs = this.horizontalVelocity.length();
    this.currentSpeedKmh = Math.round(horizSpeedMs * 3.6);
  }

  public takeRexyHit(amount: number = 1, hitDirection: THREE.Vector3): void {
    if (this.health <= 0) return;
    if (this.damageGraceTimer > 0) return; // Invulnerability grace period

    this.damageGraceTimer = this.damageGraceDuration;
    this.adrenalineTimer = VEHICLE_CONFIG.adrenalineBoostDuration;

    this.health = Math.max(0, this.health - amount);
    this.bus.emit('player_damaged', { amount, health: this.health });
    this.bus.emit('player_health_changed', { health: this.health, max: this.maxHealth });

    const hitCfg = VEHICLE_CONFIG.rexyHit;

    // Dramatic, aggressive airborne launch from Rexy's bite
    this.isAirborne = true;
    this.verticalVelocity = Math.max(hitCfg.verticalLift, hitDirection.y * 22);

    this.horizontalVelocity.x = hitDirection.x * hitCfg.horizontalSpeed;
    this.horizontalVelocity.z = hitDirection.z * hitCfg.horizontalSpeed;
    this.forwardSpeed = this.horizontalVelocity.dot(this.scratchFwd);

    // Slight yaw kick, preserving upright level attitude
    this.heading += (Math.random() - 0.5) * hitCfg.yawTorque * 0.4;

    if (this.health <= 0) {
      this.bus.emit('player_died');
    }
  }

  public pushFromRexy(pushDirection: THREE.Vector3, strength: number = 95): void {
    const shoveFactor = this.damageGraceTimer > 0 ? 0.85 : 1.5;
    this.horizontalVelocity.x += pushDirection.x * strength * shoveFactor;
    this.horizontalVelocity.z += pushDirection.z * strength * shoveFactor;
    // Violent physical body shove pops chassis into air for tumbling slide
    this.isAirborne = true;
    this.verticalVelocity = Math.max(this.verticalVelocity, 8.5);
    this.forwardSpeed = this.horizontalVelocity.dot(this.scratchFwd);
  }

  public resetUpright(): void {
    this.isAirborne = true;
    this.verticalVelocity = 4.0;
    this.forwardSpeed = 0;
    this.horizontalVelocity.set(0, 0, 0);
    this.prevGroundY = -999;
  }

  public getVelocity(out: THREE.Vector3): void {
    out.set(this.horizontalVelocity.x, this.verticalVelocity, this.horizontalVelocity.z);
  }

  public setWireframeDebug(visible: boolean): void {
    this.debugWireframeMesh.visible = visible;
  }

  public heal(amount: number = 1): void {
    const previous = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    const healed = this.health - previous;
    if (healed > 0) {
      this.bus.emit('player_healed', { amount: healed, health: this.health });
      this.bus.emit('player_health_changed', { health: this.health, max: this.maxHealth });
    }
  }

  public addSpeedBonus(amount: number = PICKUP_DEFAULTS.speedTireBonus): void {
    this.bonusSpeed += amount;
    this.bus.emit('player_speed_bonus', { bonus: this.bonusSpeed });
  }
}
