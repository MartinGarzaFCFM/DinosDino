import * as THREE from 'three';
import { Pickup } from './Pickup.ts';
import { EggPickup } from './EggPickup.ts';
import { SpeedTirePickup } from './SpeedTirePickup.ts';
import { SprayPickup } from './SprayPickup.ts';
import { HeartPickup } from './HeartPickup.ts';
import { IObstacleQuery, IPickupTarget } from '../Entity.ts';
import { ARENA_CONFIG, PICKUP_DEFAULTS } from '../../config/GameBalance.ts';
import { EventBus, IEventBus } from '../../core/EventBus.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';

export type PickupFactoryFn = (
  id: string,
  pos: THREE.Vector3,
  bus: IEventBus,
  loader: IAssetLoader
) => Pickup;

export interface PickupSpawnRule {
  prefix: string;
  count: number;
  factory: PickupFactoryFn;
}

/**
 * Open/Closed Spawner service responsible for rejection-sampling clear coordinates
 * and instantiating match collectibles.
 * Adding new pickup/trap types only requires appending a PickupSpawnRule.
 */
export class PickupSpawner {
  private readonly obstacleQuery: IObstacleQuery;
  private readonly bus: IEventBus;
  private readonly loader: IAssetLoader;
  private readonly origin = new THREE.Vector3(0, 0, 0);

  constructor(
    obstacleQuery: IObstacleQuery,
    bus: IEventBus = EventBus.getInstance(),
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    this.obstacleQuery = obstacleQuery;
    this.bus = bus;
    this.loader = loader;
  }

  public async spawnMatchPickups(eggCount: number, target: IPickupTarget): Promise<Pickup[]> {
    const rules: PickupSpawnRule[] = [
      {
        prefix: 'egg',
        count: eggCount,
        factory: (id, pos, b, l) => new EggPickup(id, pos, b, l)
      },
      {
        prefix: 'tire',
        count: PICKUP_DEFAULTS.counts.speedTires,
        factory: (id, pos, b, l) => new SpeedTirePickup(id, pos, b, l)
      },
      {
        prefix: 'spray',
        count: PICKUP_DEFAULTS.counts.sprays,
        factory: (id, pos, b, l) => new SprayPickup(id, pos, b, l)
      },
      {
        prefix: 'heart',
        count: PICKUP_DEFAULTS.counts.hearts,
        factory: (id, pos, b, l) => new HeartPickup(id, pos, b, l)
      }
    ];

    const spawned: Pickup[] = [];
    const loadPromises: Promise<void>[] = [];

    for (const rule of rules) {
      for (let i = 0; i < rule.count; i++) {
        const spawnPos = this.findClearPosition();
        const pickup = rule.factory(`${rule.prefix}_${i}`, spawnPos, this.bus, this.loader);
        pickup.setTarget(target);
        spawned.push(pickup);
        loadPromises.push(pickup.load());
      }
    }

    await Promise.all(loadPromises);
    return spawned;
  }

  private findClearPosition(): THREE.Vector3 {
    const bound = ARENA_CONFIG.pickupSpawnBound;
    const minOriginDistSq =
      ARENA_CONFIG.minDistanceFromOrigin * ARENA_CONFIG.minDistanceFromOrigin;
    const candidate = new THREE.Vector3();

    for (let attempt = 0; attempt < 80; attempt++) {
      candidate.set((Math.random() - 0.5) * bound * 2, 0, (Math.random() - 0.5) * bound * 2);

      if (candidate.distanceToSquared(this.origin) < minOriginDistSq) {
        continue;
      }

      if (this.obstacleQuery.isPositionClear(candidate, ARENA_CONFIG.buildingClearanceMargin)) {
        return candidate.clone();
      }
    }

    // Safe fallback ring outside player origin if arena is dense
    const fallbackAngle = Math.random() * Math.PI * 2;
    const fallbackDist = ARENA_CONFIG.minDistanceFromOrigin + 20;
    return new THREE.Vector3(
      Math.cos(fallbackAngle) * fallbackDist,
      0,
      Math.sin(fallbackAngle) * fallbackDist
    );
  }
}

