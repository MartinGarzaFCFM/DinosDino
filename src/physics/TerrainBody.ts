import * as THREE from 'three';
import { IDebuggable } from '../entities/Entity.ts';
import { ARENA_CONFIG } from '../config/GameBalance.ts';
import { TerrainConfig, DEFAULT_TERRAIN_CONFIG } from '../config/TerrainConfig.ts';
import { createWireframeBox } from '../graphics/GeometryUtils.ts';

export interface TerrainSurfaceInfo {
  zoneName: string;
  isHazard: boolean;
  linearDamping: number;
  elevation: number;
  slopeDegrees: number;
}

/**
 * Analytical 3D heightmap terrain, mud hazard query service, and visual PlaneGeometry mesh.
 * Eliminates external physics-engine heightfield overhead by evaluating exact cosine bell
 * elevation, central-difference surface normals, and squared-distance mud zone checks in O(1).
 */
export class TerrainBody implements IDebuggable {
  public readonly group: THREE.Group = new THREE.Group();
  public readonly mesh: THREE.Mesh;
  private readonly debugWallsGroup: THREE.Group = new THREE.Group();
  private readonly config: TerrainConfig;
  private readonly size: number;
  private readonly segments: number;

  // Preallocated result object to guarantee zero per-frame GC allocations in getSurfaceAt()
  private readonly surfaceResult: TerrainSurfaceInfo = {
    zoneName: 'Hardpack Plains',
    isHazard: false,
    linearDamping: 0.15,
    elevation: 0,
    slopeDegrees: 0
  };

  constructor(config: TerrainConfig = DEFAULT_TERRAIN_CONFIG) {
    this.config = config;
    this.size = config.size;
    this.segments = config.segments;

    // 1. Visual Ground Mesh with Procedural Elevation & Vertex Tinting
    const geometry = new THREE.PlaneGeometry(
      this.size,
      this.size,
      this.segments,
      this.segments
    );

    const posAttr = geometry.attributes.position;
    const vertexCount = posAttr.count;
    const colors = new Float32Array(vertexCount * 3);

    for (let i = 0; i < vertexCount; i++) {
      const worldX = posAttr.getX(i);
      const worldZ = -posAttr.getY(i); // Plane rotated -90 deg on X puts local -Y along world +Z

      const height = this.getHeightAt(worldX, worldZ);
      posAttr.setZ(i, height);

      // Vertex color tinting: Darken muddy hazard areas with deep murky peat/bog tint
      if (this.isHazardAt(worldX, worldZ)) {
        colors[i * 3] = 0.22;
        colors[i * 3 + 1] = 0.16;
        colors[i * 3 + 2] = 0.11;
      } else {
        const elevTint = Math.min(0.2, Math.max(0, height / 30));
        colors[i * 3] = 0.82 + elevTint * 0.5;
        colors[i * 3 + 1] = 0.88 + elevTint * 0.5;
        colors[i * 3 + 2] = 0.75 + elevTint * 0.5;
      }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      roughness: 0.88,
      metalness: 0.08,
      vertexColors: true
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    this.debugWallsGroup.visible = false;
    this.group.add(this.debugWallsGroup);

    // 2. Debug Boundary Wireframe Outlines
    this.createDebugBoundaryWalls();
  }

  /**
   * Fast zero-allocation squared-distance check for mud hazard zones.
   */
  public isHazardAt(x: number, z: number): boolean {
    for (const mud of this.config.mudZones) {
      const dx = x - mud.x;
      const dz = z - mud.z;
      if (dx * dx + dz * dz < mud.radius * mud.radius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Evaluates procedural elevation at any world (x, z) coordinates.
   * Smooth cosine falloff ensures natural slopes and stable driving gradients.
   */
  public getHeightAt(x: number, z: number): number {
    // Keep spawn sanctuary flat (radius 45m from origin -> 45² = 2025)
    const distSqFromOrigin = x * x + z * z;
    if (distSqFromOrigin < 2025) {
      return 0;
    }

    let elevation = 0;

    // 1. Hills and Elevated Ridges
    for (const hill of this.config.hills) {
      const dx = x - hill.x;
      const dz = z - hill.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < hill.radius * hill.radius) {
        const dist = Math.sqrt(distSq);
        const factor = Math.cos((Math.PI * dist) / hill.radius) * 0.5 + 0.5;
        elevation += hill.height * factor;
      }
    }

    // 2. Mud & Swamp Depressions
    for (const mud of this.config.mudZones) {
      const dx = x - mud.x;
      const dz = z - mud.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < mud.radius * mud.radius) {
        const dist = Math.sqrt(distSq);
        const factor = Math.cos((Math.PI * dist) / mud.radius) * 0.5 + 0.5;
        elevation += mud.depth * factor;
      }
    }

    // Smooth boundary ramp down near spawn buffer (45m..70m -> 70² = 4900)
    if (distSqFromOrigin < 4900) {
      const distFromOrigin = Math.sqrt(distSqFromOrigin);
      elevation *= (distFromOrigin - 45) / 25;
    }

    return elevation;
  }

  /**
   * Evaluates the upward terrain unit normal vector at (x, z) using central differences.
   * Zero allocation: populates and returns the provided Vector3 `out`.
   */
  public getNormalAt(x: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    const eps = 1.5;
    const hL = this.getHeightAt(x - eps, z);
    const hR = this.getHeightAt(x + eps, z);
    const hD = this.getHeightAt(x, z - eps);
    const hU = this.getHeightAt(x, z + eps);
    const slopeX = (hR - hL) / (2 * eps);
    const slopeZ = (hU - hD) / (2 * eps);
    return out.set(-slopeX, 1, -slopeZ).normalize();
  }

  /**
   * Queries terrain surface properties and hazards for vehicle physics and telemetry.
   * Populates and returns a shared read-only snapshot to avoid per-frame allocations.
   */
  public getSurfaceAt(x: number, z: number): Readonly<TerrainSurfaceInfo> {
    const elevation = this.getHeightAt(x, z);

    const eps = 1.5;
    const hL = this.getHeightAt(x - eps, z);
    const hR = this.getHeightAt(x + eps, z);
    const hD = this.getHeightAt(x, z - eps);
    const hU = this.getHeightAt(x, z + eps);
    const slopeX = (hR - hL) / (2 * eps);
    const slopeZ = (hU - hD) / (2 * eps);
    const gradient = Math.sqrt(slopeX * slopeX + slopeZ * slopeZ);

    const res = this.surfaceResult;
    res.elevation = Math.round(elevation * 10) / 10;
    res.slopeDegrees = Math.round(((Math.atan(gradient) * 180) / Math.PI) * 10) / 10;

    // Check Mud Hazards
    for (const mud of this.config.mudZones) {
      const dx = x - mud.x;
      const dz = z - mud.z;
      if (dx * dx + dz * dz < mud.radius * mud.radius) {
        res.zoneName = mud.name;
        res.isHazard = true;
        res.linearDamping = mud.linearDamping;
        return res;
      }
    }

    // Check Hill Landmarks
    for (const hill of this.config.hills) {
      const dx = x - hill.x;
      const dz = z - hill.z;
      if (dx * dx + dz * dz < hill.radius * hill.radius) {
        res.zoneName = hill.name;
        res.isHazard = false;
        res.linearDamping = 0.15;
        return res;
      }
    }

    res.zoneName = 'Hardpack Plains';
    res.isHazard = false;
    res.linearDamping = 0.15;
    return res;
  }

  private createDebugBoundaryWalls(): void {
    const half = ARENA_CONFIG.arenaDriveBound;
    const span = half * 2;
    const wallHeight = ARENA_CONFIG.wallHeight;
    const wallThickness = ARENA_CONFIG.wallThickness;

    const wallSizeX = { x: span, y: wallHeight, z: wallThickness };
    const wallSizeZ = { x: wallThickness, y: wallHeight, z: span };

    const walls = [
      { x: 0, y: wallHeight / 2, z: half, size: wallSizeX },
      { x: 0, y: wallHeight / 2, z: -half, size: wallSizeX },
      { x: half, y: wallHeight / 2, z: 0, size: wallSizeZ },
      { x: -half, y: wallHeight / 2, z: 0, size: wallSizeZ }
    ];

    for (const w of walls) {
      const wire = createWireframeBox(w.size, 0xffaa00);
      wire.position.set(w.x, w.y, w.z);
      this.debugWallsGroup.add(wire);
    }
  }

  public setWireframeDebug(visible: boolean): void {
    this.debugWallsGroup.visible = visible;
  }
}
