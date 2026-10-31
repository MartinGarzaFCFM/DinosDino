import * as THREE from 'three';
import { LevelTheme } from '../../core/GameState.ts';
import { Building } from './Building.ts';
import { IDebuggable, IObstacleQuery } from '../Entity.ts';
import { BUILDING_BLUEPRINTS, LEVEL_REGISTRY } from '../../config/LevelRegistry.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';

export class Environment implements IObstacleQuery, IDebuggable {
  private buildings: Building[] = [];
  private readonly scene: THREE.Scene;
  private readonly loader: IAssetLoader;
  private isDebugVisible: boolean = false;

  // Scratch Box3 to avoid allocations during pickup spawn clearance checks
  private readonly scratchExpandedBox = new THREE.Box3();

  constructor(
    scene: THREE.Scene,
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    this.scene = scene;
    this.loader = loader;
  }

  public async buildTheme(theme: LevelTheme): Promise<void> {
    this.clear();

    const levelDef = LEVEL_REGISTRY[theme];

    for (let i = 0; i < levelDef.buildings.length; i++) {
      const placement = levelDef.buildings[i];
      const blueprint = BUILDING_BLUEPRINTS[placement.blueprintId];
      const pos = new THREE.Vector3(placement.position.x, placement.position.y, placement.position.z);
      const scale = new THREE.Vector3(placement.scale, placement.scale, placement.scale);

      const building = new Building(
        `building_${theme}_${i}`,
        blueprint,
        pos,
        placement.rotationY,
        scale,
        this.loader
      );
      await building.load();
      building.setWireframeDebug(this.isDebugVisible);

      this.buildings.push(building);
      this.scene.add(building.group);
    }
  }

  public clear(): void {
    this.buildings.forEach((b) => b.destroy());
    this.buildings = [];
  }

  public setWireframeDebug(visible: boolean): void {
    this.isDebugVisible = visible;
    this.buildings.forEach((b) => b.setWireframeDebug(visible));
  }

  /**
   * Checks if a point on the terrain is clear of all building collision bounds.
   */
  public isPositionClear(pos: THREE.Vector3, margin: number = 25): boolean {
    for (const b of this.buildings) {
      if (!b.boundingBox.isEmpty()) {
        this.scratchExpandedBox.copy(b.boundingBox).expandByScalar(margin);
        if (
          pos.x >= this.scratchExpandedBox.min.x &&
          pos.x <= this.scratchExpandedBox.max.x &&
          pos.z >= this.scratchExpandedBox.min.z &&
          pos.z <= this.scratchExpandedBox.max.z
        ) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Resolves horizontal 2D compound AABB collision against all buildings.
   * Broadphase-checks the building union box first, then resolves against each compound collider
   * so L-shaped buildings (e.g., Cabin open porch) remain accurately drivable.
   */
  public resolveCollision(pos: THREE.Vector3, radius: number = 2.8): boolean {
    let collided = false;
    for (const b of this.buildings) {
      if (b.boundingBox.isEmpty()) continue;

      const uMin = b.boundingBox.min;
      const uMax = b.boundingBox.max;
      if (
        pos.x + radius <= uMin.x ||
        pos.x - radius >= uMax.x ||
        pos.z + radius <= uMin.z ||
        pos.z - radius >= uMax.z
      ) {
        continue;
      }

      for (const shapeBox of b.colliderBoxes) {
        const min = shapeBox.min;
        const max = shapeBox.max;
        if (
          pos.x + radius > min.x &&
          pos.x - radius < max.x &&
          pos.z + radius > min.z &&
          pos.z - radius < max.z
        ) {
          collided = true;
          const pushLeft = pos.x + radius - min.x;
          const pushRight = max.x - (pos.x - radius);
          const pushBack = pos.z + radius - min.z;
          const pushFront = max.z - (pos.z - radius);

          const minPush = Math.min(pushLeft, pushRight, pushBack, pushFront);
          if (minPush === pushLeft) {
            pos.x = min.x - radius;
          } else if (minPush === pushRight) {
            pos.x = max.x + radius;
          } else if (minPush === pushBack) {
            pos.z = min.z - radius;
          } else {
            pos.z = max.z + radius;
          }
        }
      }
    }
    return collided;
  }
}
