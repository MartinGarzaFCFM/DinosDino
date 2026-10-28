import * as THREE from 'three';

/**
 * Interface Segregation: Entities or systems that expose custom debug collider wireframes.
 */
export interface IDebuggable {
  setWireframeDebug(visible: boolean): void;
}

/**
 * Interface Segregation: Narrow contract for entities capable of collecting pickups.
 * Decouples Pickup subclasses from concrete Vehicle physics implementation.
 */
export interface IPickupTarget {
  readonly position: THREE.Vector3;
  heal(amount?: number): void;
  addSpeedBonus(amount?: number): void;
}

/**
 * Interface Segregation: Narrow contract for entities targeted by dinosaur AI.
 * Enables future AI vehicles or multiplayer players without modifying Rexy.
 */
export interface ICombatTarget {
  readonly position: THREE.Vector3;
  takeRexyHit(amount: number, hitDirection: THREE.Vector3): void;
  pushFromRexy(pushDirection: THREE.Vector3, strength?: number): void;
}

/**
 * Interface Segregation: Spatial query contract for checking obstacle clearance.
 */
export interface IObstacleQuery {
  isPositionClear(pos: THREE.Vector3, margin?: number): boolean;
}

/**
 * Base lifecycle class for all scene entities.
 */
export abstract class Entity {
  public readonly id: string;
  public readonly group: THREE.Group;
  public isDestroyed: boolean = false;

  constructor(id: string) {
    this.id = id;
    this.group = new THREE.Group();
  }

  public abstract update(delta: number): void;

  public destroy(): void {
    this.isDestroyed = true;
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
