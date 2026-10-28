import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Entity, ICombatTarget, IDebuggable, IPickupTarget } from '../Entity.ts';
import { PhysicsWorld } from '../../physics/PhysicsWorld.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';
import { InputState } from '../../input/InputManager.ts';
import { EventBus, IEventBus } from '../../core/EventBus.ts';
import { VEHICLE_CONFIG } from '../../config/GameBalance.ts';
import { createWireframeBox } from '../../graphics/GeometryUtils.ts';

export class Vehicle extends Entity implements IPickupTarget, ICombatTarget, IDebuggable {
  public readonly chassisBody: CANNON.Body;
  public readonly vehiclePhysics: CANNON.RaycastVehicle;
  public readonly position: THREE.Vector3 = new THREE.Vector3();
  public readonly quaternion: THREE.Quaternion = new THREE.Quaternion();

  private readonly physics: PhysicsWorld;
  private readonly bus: IEventBus;
  private readonly loader: IAssetLoader;
  private readonly debugWireframeMesh: THREE.LineSegments;
  private readonly onPostStepBound: () => void;
  private visualMesh?: THREE.Object3D;

  // Reusable vector to check upside-down orientation without per-frame allocation
  private readonly scratchUpVec = new THREE.Vector3();
  private upsideDownTimer: number = 0;

  // Tuning variables
  public baseEngineForce: number = VEHICLE_CONFIG.baseEngineForce;
  public bonusSpeed: number = 0;
  public maxSteerVal: number = VEHICLE_CONFIG.maxSteerVal;
  public brakeForce: number = VEHICLE_CONFIG.brakeForce;
  public health: number = VEHICLE_CONFIG.maxHealth;
  public readonly maxHealth: number = VEHICLE_CONFIG.maxHealth;

  public currentSpeedKmh: number = 0;

  constructor(
    id: string,
    physics: PhysicsWorld,
    spawnPos: THREE.Vector3,
    bus: IEventBus = EventBus.getInstance(),
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    super(id);
    this.physics = physics;
    this.bus = bus;
    this.loader = loader;

    // 1. Chassis Body (Box collider for armored halftrack)
    const { chassisSize } = VEHICLE_CONFIG;
    const chassisShape = new CANNON.Box(
      new CANNON.Vec3(chassisSize.x / 2, chassisSize.y / 2, chassisSize.z / 2)
    );

    this.chassisBody = new CANNON.Body({
      mass: VEHICLE_CONFIG.mass,
      material: physics.chassisMaterial,
      linearDamping: VEHICLE_CONFIG.linearDamping,
      angularDamping: VEHICLE_CONFIG.angularDamping
    });

    // Lower center of mass to prevent tipping over on sharp turns
    this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, VEHICLE_CONFIG.centerOfMassOffsetY, 0));
    this.chassisBody.position.set(
      spawnPos.x,
      spawnPos.y + VEHICLE_CONFIG.spawnElevationOffset,
      spawnPos.z
    );

    // Visual debug wireframe matching the exact Cannon chassis box
    this.debugWireframeMesh = createWireframeBox(chassisSize, 0x00ffff);
    this.debugWireframeMesh.position.set(0, VEHICLE_CONFIG.centerOfMassOffsetY, 0);
    this.debugWireframeMesh.visible = false;
    this.group.add(this.debugWireframeMesh);

    // 2. RaycastVehicle setup
    this.vehiclePhysics = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0, // X is Right
      indexUpAxis: 1, // Y is Up
      indexForwardAxis: 2 // Z is Forward
    });

    // 3. Wheel Configurations
    const wCfg = VEHICLE_CONFIG.wheel;
    const wheelOptions = {
      radius: wCfg.radius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: wCfg.suspensionStiffness,
      suspensionRestLength: wCfg.suspensionRestLength,
      frictionSlip: wCfg.frictionSlip,
      dampingRelaxation: wCfg.dampingRelaxation,
      dampingCompression: wCfg.dampingCompression,
      maxSuspensionForce: wCfg.maxSuspensionForce,
      rollInfluence: wCfg.rollInfluence,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      maxSuspensionTravel: wCfg.maxSuspensionTravel,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true
    };

    const { halfWidth: halfW, halfLength: halfL, axleY } = wCfg;

    // Front Left (0), Front Right (1), Rear Left (2), Rear Right (3)
    const wheelPoints: Array<[number, number, number]> = [
      [halfW, axleY, halfL],
      [-halfW, axleY, halfL],
      [halfW, axleY, -halfL],
      [-halfW, axleY, -halfL]
    ];

    for (const [wx, wy, wz] of wheelPoints) {
      wheelOptions.chassisConnectionPointLocal.set(wx, wy, wz);
      this.vehiclePhysics.addWheel(wheelOptions);
    }

    // addToWorld adds chassisBody AND registers RaycastVehicle's preStep handler
    this.vehiclePhysics.addToWorld(physics.world);

    this.onPostStepBound = () => {
      for (let i = 0; i < this.vehiclePhysics.wheelInfos.length; i++) {
        this.vehiclePhysics.updateWheelTransform(i);
      }
    };
    physics.world.addEventListener('postStep', this.onPostStepBound);

    this.syncTransforms();
  }

  public async loadModel(): Promise<void> {
    try {
      const gltf = await this.loader.loadGLTF(VEHICLE_CONFIG.modelUrl);
      this.visualMesh = gltf.scene.clone();
      const s = VEHICLE_CONFIG.modelScale;
      this.visualMesh.scale.set(s, s, s);

      // Car model nose faces +X; rotate +90 deg so rear faces camera and front points forward (+Z)
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
    const totalForce = this.baseEngineForce + this.bonusSpeed;

    // Negative engine force in Cannon propels RaycastVehicle along +Z (forward)
    const engineForce = -inputs.throttle * totalForce;
    this.vehiclePhysics.applyEngineForce(engineForce, 2);
    this.vehiclePhysics.applyEngineForce(engineForce, 3);

    // Front wheel steering
    const steer = -inputs.steering * this.maxSteerVal;
    this.vehiclePhysics.setSteeringValue(steer, 0);
    this.vehiclePhysics.setSteeringValue(steer, 1);

    // Brakes
    if (inputs.brake || inputs.handbrake) {
      this.vehiclePhysics.setBrake(this.brakeForce, 0);
      this.vehiclePhysics.setBrake(this.brakeForce, 1);
      this.vehiclePhysics.setBrake(this.brakeForce * 1.6, 2);
      this.vehiclePhysics.setBrake(this.brakeForce * 1.6, 3);
    } else {
      this.vehiclePhysics.setBrake(0, 0);
      this.vehiclePhysics.setBrake(0, 1);
      this.vehiclePhysics.setBrake(0, 2);
      this.vehiclePhysics.setBrake(0, 3);
    }

    if (inputs.resetVehicle) {
      this.resetUpright();
    }
  }

  public resetUpright(): void {
    this.upsideDownTimer = 0;
    this.chassisBody.position.y += 2.5;
    this.chassisBody.velocity.set(0, 2, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);

    // Retain heading (yaw) while leveling roll and pitch
    const euler = new CANNON.Vec3();
    this.chassisBody.quaternion.toEuler(euler, 'YZX');
    this.chassisBody.quaternion.setFromEuler(0, euler.y, 0);
  }

  public takeDamage(amount: number = 1): void {
    this.takeRexyHit(amount, new THREE.Vector3(0, 0.5, -1));
  }

  public takeRexyHit(amount: number = 1, hitDirection: THREE.Vector3): void {
    if (this.health <= 0) return;

    this.health = Math.max(0, this.health - amount);
    this.bus.emit('player_damaged', { amount, health: this.health });
    this.bus.emit('player_health_changed', { health: this.health, max: this.maxHealth });

    const hitCfg = VEHICLE_CONFIG.rexyHit;

    // Break ground friction by elevating chassis
    this.chassisBody.position.y += hitCfg.elevationKick;

    // Explosive physics launch
    this.chassisBody.velocity.set(
      hitDirection.x * hitCfg.horizontalSpeed,
      Math.max(hitCfg.verticalLift, hitDirection.y * 70),
      hitDirection.z * hitCfg.horizontalSpeed
    );

    // Chaotic angular tumble through the air
    this.chassisBody.angularVelocity.set(
      (Math.random() - 0.5) * hitCfg.pitchTorque,
      (Math.random() - 0.5) * hitCfg.yawTorque,
      (Math.random() - 0.5) * hitCfg.rollTorque
    );

    if (this.health <= 0) {
      this.bus.emit('player_died');
    }
  }

  public pushFromRexy(pushDirection: THREE.Vector3, strength: number = 42): void {
    this.chassisBody.velocity.x += pushDirection.x * strength;
    this.chassisBody.velocity.y += Math.max(12, pushDirection.y * strength * 0.5);
    this.chassisBody.velocity.z += pushDirection.z * strength;
    this.chassisBody.angularVelocity.x += (Math.random() - 0.5) * 6;
    this.chassisBody.angularVelocity.z += (Math.random() - 0.5) * 6;
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

  public addSpeedBonus(amount: number = 500): void {
    this.bonusSpeed += amount;
    this.bus.emit('player_speed_bonus', { bonus: this.bonusSpeed });
  }

  public update(delta: number): void {
    this.syncTransforms();

    // Calculate horizontal speedometer reading in km/h
    const vel = this.chassisBody.velocity;
    const speedMs = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    this.currentSpeedKmh = Math.round(speedMs * 3.6);

    // Auto-recover if stranded upside down on the roof for > 2.5s
    this.scratchUpVec.set(0, 1, 0).applyQuaternion(this.quaternion);
    if (this.scratchUpVec.y < -0.25 && this.currentSpeedKmh < 8) {
      this.upsideDownTimer += delta;
      if (this.upsideDownTimer >= 2.5) {
        this.resetUpright();
      }
    } else {
      this.upsideDownTimer = 0;
    }
  }

  private syncTransforms(): void {
    const p = this.chassisBody.position;
    const q = this.chassisBody.quaternion;
    this.position.set(p.x, p.y, p.z);
    this.quaternion.set(q.x, q.y, q.z, q.w);

    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.quaternion);
  }

  public override destroy(): void {
    super.destroy();
    this.physics.world.removeEventListener('postStep', this.onPostStepBound);
    // removeFromWorld removes both chassisBody and RaycastVehicle's preStep listener
    this.vehiclePhysics.removeFromWorld(this.physics.world);
  }
}
