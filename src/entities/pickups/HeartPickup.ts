import * as THREE from 'three';
import { Pickup, PickupVisualConfig } from './Pickup.ts';
import { IPickupTarget } from '../Entity.ts';
import { EventBus, IEventBus } from '../../core/EventBus.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';
import { PICKUP_DEFAULTS } from '../../config/GameBalance.ts';

const HEART_VISUAL_CONFIG: PickupVisualConfig = {
  typeName: 'HeartPickup',
  modelUrl: '/assets/modelos/Heart.fbx',
  scale: 0.05,
  beaconColor: 0xff1744
};

export class HeartPickup extends Pickup {
  constructor(
    id: string,
    spawnPos: THREE.Vector3,
    bus: IEventBus = EventBus.getInstance(),
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    super(id, spawnPos, HEART_VISUAL_CONFIG, bus, loader);
  }

  protected createFallbackMesh(): THREE.Object3D {
    const geo = new THREE.DodecahedronGeometry(2.5);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff1744,
      roughness: 0.2,
      metalness: 0.4,
      emissive: 0x550011
    });
    return new THREE.Mesh(geo, mat);
  }

  protected onCollect(target: IPickupTarget): void {
    target.heal(PICKUP_DEFAULTS.heartHealAmount);
  }
}
