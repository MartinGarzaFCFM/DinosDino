import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export enum CameraMode {
  CHASE = 'CHASE',
  ORBIT = 'ORBIT'
}

export class CameraController {
  public readonly camera: THREE.PerspectiveCamera;
  private readonly orbitControls: OrbitControls;
  private readonly container: HTMLElement;
  private readonly onResizeBound: () => void;
  public mode: CameraMode = CameraMode.CHASE;

  // Chase parameters (wide third-person survival camera view)
  private readonly idealOffset = new THREE.Vector3(0, 13, -38);
  private readonly idealLookat = new THREE.Vector3(0, 3.5, 12);
  private readonly currentPosition = new THREE.Vector3();
  private readonly currentLookat = new THREE.Vector3();

  // Camera trauma / screen-shake state (0..1)
  private trauma: number = 0;

  // Reusable scratch objects to guarantee zero per-frame GC allocations
  private readonly scratchWorldOffset = new THREE.Vector3();
  private readonly scratchWorldLookat = new THREE.Vector3();
  private readonly scratchShakeOffset = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.container = container;
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      3000
    );
    this.camera.position.set(0, 15, -20);

    this.orbitControls = new OrbitControls(this.camera, container);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.enabled = false;

    this.onResizeBound = () => {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this.onResizeBound);
  }

  public toggleMode(): CameraMode {
    this.mode = this.mode === CameraMode.CHASE ? CameraMode.ORBIT : CameraMode.CHASE;
    this.orbitControls.enabled = this.mode === CameraMode.ORBIT;
    return this.mode;
  }

  /**
   * Adds screen-shake trauma (0..1) for heavy impacts such as Rexy attacks.
   */
  public addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  public update(targetPos: THREE.Vector3, targetQuat: THREE.Quaternion, delta: number): void {
    if (this.mode === CameraMode.ORBIT) {
      this.orbitControls.target.copy(targetPos);
      this.orbitControls.update();
      return;
    }

    this.scratchWorldOffset.copy(this.idealOffset).applyQuaternion(targetQuat).add(targetPos);
    this.scratchWorldLookat.copy(this.idealLookat).applyQuaternion(targetQuat).add(targetPos);

    // Frame-rate independent exponential smoothing
    const lerpSpeed = 1.0 - Math.pow(0.001, delta);
    this.currentPosition.lerp(this.scratchWorldOffset, lerpSpeed);
    this.currentLookat.lerp(this.scratchWorldLookat, lerpSpeed);

    this.camera.position.copy(this.currentPosition);

    // Apply decaying quadratic trauma shake if active
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

  public snapTo(targetPos: THREE.Vector3, targetQuat: THREE.Quaternion): void {
    this.trauma = 0;
    this.currentPosition.copy(this.idealOffset).applyQuaternion(targetQuat).add(targetPos);
    this.currentLookat.copy(this.idealLookat).applyQuaternion(targetQuat).add(targetPos);
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookat);
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResizeBound);
    this.orbitControls.dispose();
  }
}
