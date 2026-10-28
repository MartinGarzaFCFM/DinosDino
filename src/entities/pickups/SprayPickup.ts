import * as THREE from 'three';
import { Pickup, PickupVisualConfig } from './Pickup.ts';
import { IPickupTarget } from '../Entity.ts';
import { EventBus, IEventBus } from '../../core/EventBus.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';
import { PICKUP_DEFAULTS } from '../../config/GameBalance.ts';

const SPRAY_VISUAL_CONFIG: PickupVisualConfig = {
  typeName: 'SprayPickup',
  modelUrl: '/assets/modelos/Spray.fbx',
  scale: 0.065,
  beaconColor: 0xcc00ff
};

export class SprayPickup extends Pickup {
  constructor(
    id: string,
    spawnPos: THREE.Vector3,
    bus: IEventBus = EventBus.getInstance(),
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    super(id, spawnPos, SPRAY_VISUAL_CONFIG, bus, loader);
  }

  protected createFallbackMesh(): THREE.Object3D {
    const geo = new THREE.CylinderGeometry(1.2, 1.2, 3.5, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xcc00ff,
      metalness: 0.5,
      roughness: 0.3,
      emissive: 0x330044
    });
    return new THREE.Mesh(geo, mat);
  }

  protected onCollect(_target: IPickupTarget): void {
    this.bus.emit('rexy_slow_requested', { amount: PICKUP_DEFAULTS.spraySlowAmount });
  }
}
