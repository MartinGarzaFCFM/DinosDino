import * as THREE from 'three';
import { Pickup, PickupVisualConfig } from './Pickup.ts';
import { IPickupTarget } from '../Entity.ts';
import { EventBus, IEventBus } from '../../core/EventBus.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';
import { PICKUP_DEFAULTS } from '../../config/GameBalance.ts';

const SPEED_TIRE_VISUAL_CONFIG: PickupVisualConfig = {
  typeName: 'SpeedTirePickup',
  modelUrl: '/assets/modelos/tire.fbx',
  scale: 0.045,
  beaconColor: 0x00f0ff
};

export class SpeedTirePickup extends Pickup {
  constructor(
    id: string,
    spawnPos: THREE.Vector3,
    bus: IEventBus = EventBus.getInstance(),
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    super(id, spawnPos, SPEED_TIRE_VISUAL_CONFIG, bus, loader);
  }

  protected createFallbackMesh(): THREE.Object3D {
    const geo = new THREE.TorusGeometry(2, 0.8, 16, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x004455
    });
    return new THREE.Mesh(geo, mat);
  }

  protected onCollect(target: IPickupTarget): void {
    target.addSpeedBonus(PICKUP_DEFAULTS.speedTireBonus);
  }
}
