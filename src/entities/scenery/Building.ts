import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Entity, IDebuggable } from '../Entity.ts';
import { PhysicsWorld } from '../../physics/PhysicsWorld.ts';
import { AssetLoader, IAssetLoader } from '../../graphics/AssetLoader.ts';
import { BuildingBlueprint, BuildingMaterialOverride } from '../../config/LevelRegistry.ts';
import { createWireframeBox, ensureBoxUVs } from '../../graphics/GeometryUtils.ts';

export class Building extends Entity implements IDebuggable {
  public cannonBody?: CANNON.Body;
  public readonly boundingBox: THREE.Box3 = new THREE.Box3();
  private readonly debugWireframeGroup: THREE.Group = new THREE.Group();

  private readonly blueprint: BuildingBlueprint;
  private readonly physics: PhysicsWorld;
  private readonly loader: IAssetLoader;
  private readonly scale: THREE.Vector3;
  private readonly rotationY: number;
  private readonly spawnPos: THREE.Vector3;

  constructor(
    id: string,
    blueprint: BuildingBlueprint,
    spawnPos: THREE.Vector3,
    rotationY: number,
    scale: THREE.Vector3,
    physics: PhysicsWorld,
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    super(id);
    this.blueprint = blueprint;
    this.spawnPos = spawnPos;
    this.rotationY = rotationY;
    this.scale = scale;
    this.physics = physics;
    this.loader = loader;

    this.debugWireframeGroup.visible = false;
    this.group.add(this.debugWireframeGroup);
  }

  public async load(): Promise<void> {
    try {
      const fbx = await this.loader.loadFBX(this.blueprint.modelUrl);

      const mesh = fbx.clone(true);
      mesh.position.copy(this.spawnPos);
      mesh.rotation.y = this.rotationY;
      mesh.scale.copy(this.scale);

      if (this.blueprint.materialOverride) {
        await this.applyMaterialOverride(mesh, this.blueprint.materialOverride);
      }

      mesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.group.add(mesh);

      // Build static compound physics body & matching debug outlines
      this.cannonBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        material: this.physics.groundMaterial
      });
      this.cannonBody.position.set(this.spawnPos.x, this.spawnPos.y, this.spawnPos.z);
      this.cannonBody.quaternion.setFromEuler(0, this.rotationY, 0);

      const collisionBoxes = this.resolveScaledCollisionBoxes(fbx);
      const yAxis = new THREE.Vector3(0, 1, 0);

      for (const box of collisionBoxes) {
        const halfExtents = new CANNON.Vec3(box.size.x / 2, box.size.y / 2, box.size.z / 2);
        const centerOffset = new CANNON.Vec3(box.center.x, box.center.y, box.center.z);
        this.cannonBody.addShape(new CANNON.Box(halfExtents), centerOffset);

        const wireframeBox = createWireframeBox(box.size, 0x00ff44);
        const rotatedOffset = box.center.clone().applyAxisAngle(yAxis, this.rotationY);
        wireframeBox.position.copy(this.spawnPos).add(rotatedOffset);
        wireframeBox.rotation.y = this.rotationY;
        this.debugWireframeGroup.add(wireframeBox);
      }

      this.physics.world.addBody(this.cannonBody);

      // Compute world clearance bounding box from actual collider shapes (avoids stray mesh vertices)
      this.computeClearanceBounds(collisionBoxes);
    } catch (e) {
      console.warn(`Could not load building model ${this.blueprint.modelUrl}:`, e);
    }
  }

  private async applyMaterialOverride(
    mesh: THREE.Group,
    override: BuildingMaterialOverride
  ): Promise<void> {
    let surfaceTexture: THREE.Texture | undefined;
    if (override.textureUrl) {
      try {
        surfaceTexture = await this.loader.loadTexture(override.textureUrl);
        surfaceTexture.wrapS = THREE.RepeatWrapping;
        surfaceTexture.wrapT = THREE.RepeatWrapping;
        const rep = override.textureRepeat ?? 4;
        surfaceTexture.repeat.set(rep, rep);
      } catch (e) {
        console.warn(`Could not load override texture ${override.textureUrl}:`, e);
      }
    }

    mesh.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const m = child as THREE.Mesh;

      if (override.generateBoxUVsScale) {
        ensureBoxUVs(m.geometry, override.generateBoxUVsScale);
      }

      const isChimney =
        override.chimneyColorHex !== undefined && m.name.toLowerCase().includes('cylinder');
      const colorHex = isChimney ? override.chimneyColorHex! : override.primaryColorHex;

      m.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        map: surfaceTexture || null,
        roughness: override.roughness,
        metalness: override.metalness,
        side: THREE.DoubleSide
      });
    });
  }

  private resolveScaledCollisionBoxes(
    fbx: THREE.Group
  ): Array<{ size: THREE.Vector3; center: THREE.Vector3 }> {
    const s = this.scale;

    if (this.blueprint.localColliders && this.blueprint.localColliders.length > 0) {
      return this.blueprint.localColliders.map((def) => ({
        size: new THREE.Vector3(def.size.x * s.x, def.size.y * s.y, def.size.z * s.z),
        center: new THREE.Vector3(def.center.x * s.x, def.center.y * s.y, def.center.z * s.z)
      }));
    }

    // Fallback: auto-compute unrotated AABB
    const unrotated = fbx.clone();
    unrotated.scale.copy(s);
    const box = new THREE.Box3().setFromObject(unrotated);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const shrink = this.blueprint.autoColliderHorizontalShrink ?? 0.92;
    return [
      {
        size: new THREE.Vector3(size.x * shrink, size.y, size.z * shrink),
        center
      }
    ];
  }

  private computeClearanceBounds(
    collisionBoxes: Array<{ size: THREE.Vector3; center: THREE.Vector3 }>
  ): void {
    this.boundingBox.makeEmpty();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const cos = Math.abs(Math.cos(this.rotationY));
    const sin = Math.abs(Math.sin(this.rotationY));

    for (const box of collisionBoxes) {
      const worldCenter = box.center.clone().applyAxisAngle(yAxis, this.rotationY).add(this.spawnPos);
      const halfX = (box.size.x * cos + box.size.z * sin) / 2;
      const halfY = box.size.y / 2;
      const halfZ = (box.size.x * sin + box.size.z * cos) / 2;

      const shapeBox = new THREE.Box3(
        new THREE.Vector3(worldCenter.x - halfX, worldCenter.y - halfY, worldCenter.z - halfZ),
        new THREE.Vector3(worldCenter.x + halfX, worldCenter.y + halfY, worldCenter.z + halfZ)
      );
      this.boundingBox.union(shapeBox);
    }
  }

  public setWireframeDebug(visible: boolean): void {
    this.debugWireframeGroup.visible = visible;
  }

  public update(_delta: number): void {
    // Static scenery requires no per-frame tick
  }

  public override destroy(): void {
    super.destroy();
    if (this.cannonBody) {
      this.physics.world.removeBody(this.cannonBody);
      this.cannonBody = undefined;
    }
  }
}
