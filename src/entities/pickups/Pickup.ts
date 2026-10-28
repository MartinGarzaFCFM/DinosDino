import * as THREE from 'three';
import { Entity, IPickupTarget } from '../Entity.ts';
import { EventBus, IEventBus } from '../../core/EventBus.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';
import { PICKUP_DEFAULTS } from '../../config/GameBalance.ts';

export interface PickupVisualConfig {
  readonly typeName: string;
  readonly modelUrl: string;
  readonly scale: number;
  readonly beaconColor: number;
}

/**
 * Template-method base class for all collectible items in the arena.
 * Handles beacon rendering, model loading/fallback, idle bobbing/spinning,
 * and zero-allocation proximity detection against IPickupTarget.
 */
export abstract class Pickup extends Entity {
  protected visualMesh?: THREE.Object3D;
  protected readonly bus: IEventBus;
  protected readonly loader: IAssetLoader;
  protected readonly visualConfig: PickupVisualConfig;

  public readonly position: THREE.Vector3;
  private readonly initialY: number;
  private bobTime: number = Math.random() * Math.PI * 2;
  private readonly pickupRadiusSq: number =
    PICKUP_DEFAULTS.pickupRadius * PICKUP_DEFAULTS.pickupRadius;
  public isCollected: boolean = false;
  private target?: IPickupTarget;

  constructor(
    id: string,
    spawnPos: THREE.Vector3,
    visualConfig: PickupVisualConfig,
    bus: IEventBus = EventBus.getInstance(),
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    super(id);
    this.bus = bus;
    this.loader = loader;
    this.visualConfig = visualConfig;
    this.position = spawnPos.clone();
    this.initialY = spawnPos.y + PICKUP_DEFAULTS.hoverOffsetY;
    this.group.position.copy(this.position);

    this.createBeacon(visualConfig.beaconColor);
  }

  public setTarget(target?: IPickupTarget): void {
    this.target = target;
  }

  public async load(): Promise<void> {
    try {
      const fbx = await this.loader.loadFBX(this.visualConfig.modelUrl);
      this.visualMesh = fbx.clone(true);
      const s = this.visualConfig.scale;
      this.visualMesh.scale.set(s, s, s);

      this.visualMesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.visualMesh.position.y = this.initialY;
      this.group.add(this.visualMesh);
    } catch {
      this.visualMesh = this.createFallbackMesh();
      this.visualMesh.position.y = this.initialY;
      this.group.add(this.visualMesh);
    }
  }

  protected abstract createFallbackMesh(): THREE.Object3D;
  protected abstract onCollect(target: IPickupTarget): void;

  private createBeacon(color: number): void {
    // 1. Additive vertical light pillar (zero dynamic PointLights -> zero shader recompilation hitches)
    const beamHeight = 70;
    const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, beamHeight, 8);
    beamGeo.translate(0, 5 + beamHeight / 2, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.userData.ignoreDebugWireframe = true;
    this.group.add(beamMesh);

    // 2. Glowing base ring on the ground
    const ringGeo = new THREE.RingGeometry(2.0, 2.5, 24);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.translate(0, 0.1, 0);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.userData.ignoreDebugWireframe = true;
    this.group.add(ringMesh);
  }

  public update(delta: number): void {
    if (this.isCollected || this.isDestroyed) return;

    this.bobTime += delta * PICKUP_DEFAULTS.bobFrequency;
    if (this.visualMesh) {
      this.visualMesh.position.y =
        this.initialY + Math.sin(this.bobTime) * PICKUP_DEFAULTS.bobAmplitude;
      this.visualMesh.rotation.y += delta * PICKUP_DEFAULTS.spinSpeed;
    }

    if (this.target) {
      if (this.group.position.distanceToSquared(this.target.position) < this.pickupRadiusSq) {
        this.collect(this.target);
      }
    }
  }

  private collect(target: IPickupTarget): void {
    this.isCollected = true;
    this.onCollect(target);
    this.bus.emit('pickup_collected', { id: this.id, type: this.visualConfig.typeName });
    this.destroy();
  }
}
