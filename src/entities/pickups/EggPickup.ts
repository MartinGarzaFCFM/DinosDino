import * as THREE from 'three';
import { Pickup, PickupVisualConfig } from './Pickup.ts';
import { IPickupTarget } from '../Entity.ts';
import { EventBus, IEventBus } from '../../core/EventBus.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';

const EGG_VISUAL_CONFIG: PickupVisualConfig = {
  typeName: 'EggPickup',
  modelUrl: '/assets/modelos/Huevo.fbx',
  scale: 1.2,
  beaconColor: 0xffd700
};

export class EggPickup extends Pickup {
  constructor(
    id: string,
    spawnPos: THREE.Vector3,
    bus: IEventBus = EventBus.getInstance(),
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    super(id, spawnPos, EGG_VISUAL_CONFIG, bus, loader);
  }

  protected createFallbackMesh(): THREE.Object3D {
    const geo = new THREE.SphereGeometry(6, 24, 24);
    geo.scale(1, 1.4, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.7,
      roughness: 0.2,
      emissive: 0x443300
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  protected onCollect(_target: IPickupTarget): void {
    this.bus.emit('egg_collected', { id: this.id });
  }
}
