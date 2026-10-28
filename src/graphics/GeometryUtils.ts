import * as THREE from 'three';

/**
 * Generates planar / box projection UV coordinates for any geometry that lacks them.
 * Allows UV-less FBX assets (such as Factory.fbx) to render tiled PBR textures cleanly.
 */
export function ensureBoxUVs(geometry: THREE.BufferGeometry, scale: number = 0.05): void {
  if (geometry.attributes.uv) return;

  const pos = geometry.attributes.position;
  if (!pos) return;

  const norms = geometry.attributes.normal;
  const uvs = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    let nx = 0;
    let ny = 1;
    let nz = 0;
    if (norms) {
      nx = Math.abs(norms.getX(i));
      ny = Math.abs(norms.getY(i));
      nz = Math.abs(norms.getZ(i));
    }

    if (nx >= ny && nx >= nz) {
      uvs[i * 2] = z * scale;
      uvs[i * 2 + 1] = y * scale;
    } else if (ny >= nx && ny >= nz) {
      uvs[i * 2] = x * scale;
      uvs[i * 2 + 1] = z * scale;
    } else {
      uvs[i * 2] = x * scale;
      uvs[i * 2 + 1] = y * scale;
    }
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

/**
 * Helper to create a wireframe outline LineSegments mesh from box dimensions.
 */
export function createWireframeBox(
  size: { x: number; y: number; z: number },
  colorHex: number
): THREE.LineSegments {
  const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const edges = new THREE.EdgesGeometry(boxGeo);
  boxGeo.dispose(); // EdgesGeometry copies vertices; dispose temporary BoxGeometry
  const mat = new THREE.LineBasicMaterial({ color: colorHex });
  return new THREE.LineSegments(edges, mat);
}

