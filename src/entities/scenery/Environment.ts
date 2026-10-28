import * as THREE from 'three';
import { LevelTheme } from '../../core/GameState.ts';
import { PhysicsWorld } from '../../physics/PhysicsWorld.ts';
import { Building } from './Building.ts';
import { IDebuggable, IObstacleQuery } from '../Entity.ts';
import { BUILDING_BLUEPRINTS, LEVEL_REGISTRY } from '../../config/LevelRegistry.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';

export class Environment implements IObstacleQuery, IDebuggable {
  private buildings: Building[] = [];
  private readonly scene: THREE.Scene;
  private readonly physics: PhysicsWorld;
  private readonly loader: IAssetLoader;
  private isDebugVisible: boolean = false;

  // Scratch Box3 to avoid allocations during pickup spawn clearance checks
  private readonly scratchExpandedBox = new THREE.Box3();

  constructor(
    scene: THREE.Scene,
    physics: PhysicsWorld,
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    this.scene = scene;
    this.physics = physics;
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
        this.physics,
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
}
