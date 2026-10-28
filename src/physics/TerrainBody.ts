import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from './PhysicsWorld.ts';
import { IDebuggable } from '../entities/Entity.ts';
import { ARENA_CONFIG } from '../config/GameBalance.ts';
import { createWireframeBox } from '../graphics/GeometryUtils.ts';

export class TerrainBody implements IDebuggable {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly mesh: THREE.Mesh;
  public readonly body: CANNON.Body;
  private readonly debugWallsGroup: THREE.Group = new THREE.Group();
  private readonly size: number = ARENA_CONFIG.terrainSize;

  constructor(physics: PhysicsWorld) {
    // 1. Visual Ground Mesh
    const geometry = new THREE.PlaneGeometry(this.size, this.size, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.1
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    this.debugWallsGroup.visible = false;
    this.group.add(this.debugWallsGroup);

    // 2. Physics Static Ground Body
    this.body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      material: physics.groundMaterial
    });

    const groundShape = new CANNON.Plane();
    this.body.addShape(groundShape);
    this.body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.body.position.set(0, 0, 0);
    physics.world.addBody(this.body);

    // 3. Boundary Invisible Walls (keeps vehicles inside arena)
    this.createBoundaryWalls(physics);
  }

  private createBoundaryWalls(physics: PhysicsWorld): void {
    const half = this.size / 2;
    const wallHeight = ARENA_CONFIG.wallHeight;
    const wallThickness = ARENA_CONFIG.wallThickness;

    const wallSizeX = { x: this.size, y: wallHeight, z: wallThickness };
    const wallSizeZ = { x: wallThickness, y: wallHeight, z: this.size };

    const wallShapeX = new CANNON.Box(new CANNON.Vec3(half, wallHeight / 2, wallThickness / 2));
    const wallShapeZ = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, wallHeight / 2, half));

    const walls = [
      { pos: new CANNON.Vec3(0, wallHeight / 2, half), shape: wallShapeX, size: wallSizeX },
      { pos: new CANNON.Vec3(0, wallHeight / 2, -half), shape: wallShapeX, size: wallSizeX },
      { pos: new CANNON.Vec3(half, wallHeight / 2, 0), shape: wallShapeZ, size: wallSizeZ },
      { pos: new CANNON.Vec3(-half, wallHeight / 2, 0), shape: wallShapeZ, size: wallSizeZ }
    ];

    walls.forEach(({ pos, shape, size }) => {
      const wallBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        position: pos,
        shape: shape,
        material: physics.groundMaterial
      });
      physics.world.addBody(wallBody);

      const wire = createWireframeBox(size, 0xffaa00);
      wire.position.set(pos.x, pos.y, pos.z);
      this.debugWallsGroup.add(wire);
    });
  }

  public setWireframeDebug(visible: boolean): void {
    this.debugWallsGroup.visible = visible;
  }
}
