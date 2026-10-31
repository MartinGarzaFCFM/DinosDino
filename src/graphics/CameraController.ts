import * as THREE from 'three';

export enum CameraMode {
  CHASE = 'CHASE',
  REXY_FOCUS = 'REXY_FOCUS'
}

export class CameraController {
  public readonly camera: THREE.PerspectiveCamera;
  private readonly container: HTMLElement;
  private readonly onResizeBound: () => void;
  public mode: CameraMode = CameraMode.CHASE;

  // Chase parameters (aggressive low-slung perspective for high-speed ground rush)
  private readonly idealOffset = new THREE.Vector3(0, 9.2, -27);
  private readonly idealLookat = new THREE.Vector3(0, 2.6, 9);
  private readonly currentPosition = new THREE.Vector3();
  private readonly currentLookat = new THREE.Vector3();

  // Camera trauma / screen-shake state (0..1)
  private trauma: number = 0;
  private prevSpeedKmh: number = 0;

  // Configurable speed tunnel FOV intensity (0.0 = locked 60deg, 0.35 = subtle, 1.0 = intense)
  public speedFovMultiplier: number = 0.35;

  // Reusable scratch objects to guarantee zero per-frame GC allocations
  private readonly scratchWorldOffset = new THREE.Vector3();
  private readonly scratchWorldLookat = new THREE.Vector3();
  private readonly scratchShakeOffset = new THREE.Vector3();
  private readonly scratchDynamicOffset = new THREE.Vector3();
  private readonly scratchTargetDir = new THREE.Vector3();
  private readonly scratchPlayerTarget = new THREE.Vector3();
  private readonly scratchRexyTarget = new THREE.Vector3();
  private readonly lastFocusDir = new THREE.Vector3(0, 0, -1);

  constructor(container: HTMLElement) {
    this.container = container;
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      3000
    );
    this.camera.position.set(0, 15, -20);

    this.onResizeBound = () => {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this.onResizeBound);
  }

  public toggleMode(): CameraMode {
    this.mode = this.mode === CameraMode.CHASE ? CameraMode.REXY_FOCUS : CameraMode.CHASE;
    return this.mode;
  }

  /**
   * Adds screen-shake trauma (0..1) for heavy impacts such as Rexy attacks.
   */
  public addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  public update(
    targetPos: THREE.Vector3,
    targetQuat: THREE.Quaternion,
    delta: number,
    speedKmh: number = 0,
    rexyPos?: THREE.Vector3
  ): void {
    if (this.mode === CameraMode.REXY_FOCUS && rexyPos) {
      this.updateRexyFocusCam(targetPos, targetQuat, rexyPos, delta, speedKmh);
    } else {
      this.updateChaseCam(targetPos, targetQuat, delta, speedKmh);
    }

    // Dynamic FOV widening: scales smoothly across full high-speed range (up to 320+ km/h)
    const baseFov = 60;
    const maxFovBoost = 24 * this.speedFovMultiplier;
    const speedNorm = Math.max(0, speedKmh) / 320;
    const targetFov = baseFov + Math.min(maxFovBoost, speedNorm * maxFovBoost);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, delta * 4));
      this.camera.updateProjectionMatrix();
    }

    // High speed road rumble with tactile physical vibration
    if (speedKmh > 90 && this.speedFovMultiplier > 0) {
      const rumble = THREE.MathUtils.clamp(((speedKmh - 90) / 220) * 0.35, 0, 0.45) * this.speedFovMultiplier;
      this.camera.position.x += (Math.random() - 0.5) * rumble;
      this.camera.position.y += (Math.random() - 0.5) * rumble;
    }

    // Apply decaying quadratic trauma shake if active (Rexy hits)
    if (this.trauma > 0) {
      const shake = this.trauma * this.trauma * 1.8;
      this.scratchShakeOffset.set(
        (Math.random() * 2 - 1) * shake,
        (Math.random() * 2 - 1) * shake,
        (Math.random() * 2 - 1) * shake
      );
      this.camera.position.add(this.scratchShakeOffset);
      this.trauma = Math.max(0, this.trauma - delta * 1.8);
    }

    this.camera.lookAt(this.currentLookat);
  }

  private updateChaseCam(
    targetPos: THREE.Vector3,
    targetQuat: THREE.Quaternion,
    delta: number,
    speedKmh: number
  ): void {
    // Acceleration surge G-force: pulls camera back momentarily when stomping the gas
    const speedDelta = speedKmh - this.prevSpeedKmh;
    const accelG = delta > 0.001 ? THREE.MathUtils.clamp((speedDelta / delta) * 0.03, -1.2, 2.5) : 0;
    this.prevSpeedKmh = speedKmh;

    // Dynamic speed sensation: Pull camera back and drop lower into an aggressive racing stance
    const speedRatio = Math.min(1.0, Math.max(0, speedKmh) / 280);
    this.scratchDynamicOffset.set(
      this.idealOffset.x,
      this.idealOffset.y - speedRatio * 2.5 * this.speedFovMultiplier - Math.max(0, accelG * 0.2 * this.speedFovMultiplier),
      this.idealOffset.z - speedRatio * 8.0 * this.speedFovMultiplier - accelG * 1.4 * this.speedFovMultiplier
    );

    this.scratchWorldOffset.copy(this.scratchDynamicOffset).applyQuaternion(targetQuat).add(targetPos);
    this.scratchWorldLookat.copy(this.idealLookat).applyQuaternion(targetQuat).add(targetPos);

    // Frame-rate independent exponential smoothing
    const lerpSpeed = 1.0 - Math.pow(0.001, delta);
    this.currentPosition.lerp(this.scratchWorldOffset, lerpSpeed);
    this.currentLookat.lerp(this.scratchWorldLookat, lerpSpeed);

    this.camera.position.copy(this.currentPosition);
  }

  /**
   * Rocket League "Ball Cam" style tracking for Rexy:
   * Frames both the player vehicle and Rexy on screen at all times while allowing
   * full driving freedom in any heading direction.
   */
  private updateRexyFocusCam(
    targetPos: THREE.Vector3,
    targetQuat: THREE.Quaternion,
    rexyPos: THREE.Vector3,
    delta: number,
    speedKmh: number
  ): void {
    // 1. Vector from Rexy to Player in horizontal XZ plane
    this.scratchTargetDir.subVectors(targetPos, rexyPos);
    this.scratchTargetDir.y = 0;
    const distXZ = this.scratchTargetDir.length();
    const dist3D = targetPos.distanceTo(rexyPos);

    if (distXZ > 1.2) {
      this.scratchTargetDir.divideScalar(distXZ);
      // Smoothly blend direction to prevent sudden flips during close passes
      const blend = Math.min(1.0, 9.0 * delta);
      this.lastFocusDir.lerp(this.scratchTargetDir, blend).normalize();
    } else if (this.lastFocusDir.lengthSq() < 0.1) {
      // Fallback: vehicle rear direction
      this.lastFocusDir.set(0, 0, -1).applyQuaternion(targetQuat);
      this.lastFocusDir.y = 0;
      this.lastFocusDir.normalize();
    }

    // 2. Camera Framing Distance & Height (Rocket League Ball Cam style)
    const speedRatio = Math.min(1.0, Math.max(0, speedKmh) / 280);
    // When Rexy is close (<55m), camera pulls back and elevates slightly to comfortably frame Rexy's 12m height
    const closeRatio = THREE.MathUtils.clamp((55.0 - dist3D) / 45.0, 0, 1.0);
    const camDist = 24.0 + speedRatio * 5.0 + closeRatio * 6.0;
    const camHeight = 8.5 + closeRatio * 4.5;

    // Camera sits behind the vehicle along the Rexy -> Player ray
    this.scratchWorldOffset.copy(targetPos).addScaledVector(this.lastFocusDir, camDist);
    this.scratchWorldOffset.y = targetPos.y + camHeight;

    // 3. User Specification: point to an in-between position between Rexy and the player
    // Player target: vehicle chassis center (y + 1.8)
    this.scratchPlayerTarget.set(targetPos.x, targetPos.y + 1.8, targetPos.z);

    // Rexy target: Rexy chest / upper torso (y + 5.5)
    this.scratchRexyTarget.set(rexyPos.x, rexyPos.y + 5.5, rexyPos.z);

    // Dynamic look-at distance: clamps look-at distance ahead of the car between 4m and 35m.
    // This keeps the player vehicle grounded in the lower-third of the frame at all times,
    // while keeping Rexy visible in the upper frame without aiming the camera straight into the sky.
    const lookDist = THREE.MathUtils.clamp(dist3D * 0.33, 4.0, 35.0);
    const lookRatio = dist3D > 0.001 ? lookDist / dist3D : 0;
    this.scratchWorldLookat.lerpVectors(this.scratchPlayerTarget, this.scratchRexyTarget, lookRatio);

    // 4. Smooth Frame-rate independent exponential interpolation
    const posLerp = 1.0 - Math.pow(0.0006, delta);
    const lookLerp = 1.0 - Math.pow(0.0001, delta);
    this.currentPosition.lerp(this.scratchWorldOffset, posLerp);
    this.currentLookat.lerp(this.scratchWorldLookat, lookLerp);

    this.camera.position.copy(this.currentPosition);
  }

  public snapTo(targetPos: THREE.Vector3, targetQuat: THREE.Quaternion, rexyPos?: THREE.Vector3): void {
    this.trauma = 0;
    this.prevSpeedKmh = 0;

    if (this.mode === CameraMode.REXY_FOCUS && rexyPos) {
      this.scratchTargetDir.subVectors(targetPos, rexyPos);
      this.scratchTargetDir.y = 0;
      if (this.scratchTargetDir.lengthSq() > 0.1) {
        this.lastFocusDir.copy(this.scratchTargetDir.normalize());
      } else {
        this.lastFocusDir.set(0, 0, -1).applyQuaternion(targetQuat);
        this.lastFocusDir.y = 0;
        this.lastFocusDir.normalize();
      }
      this.currentPosition.copy(targetPos).addScaledVector(this.lastFocusDir, 25.0);
      this.currentPosition.y = targetPos.y + 9.0;

      this.scratchPlayerTarget.set(targetPos.x, targetPos.y + 1.8, targetPos.z);
      this.scratchRexyTarget.set(rexyPos.x, rexyPos.y + 5.5, rexyPos.z);
      this.currentLookat.lerpVectors(this.scratchPlayerTarget, this.scratchRexyTarget, 0.33);
    } else {
      this.currentPosition.copy(this.idealOffset).applyQuaternion(targetQuat).add(targetPos);
      this.currentLookat.copy(this.idealLookat).applyQuaternion(targetQuat).add(targetPos);
    }

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookat);
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResizeBound);
  }
}
