import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function CrearOrbitControls(camera, renderer) {
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.rotateSpeed = 1.0
    orbitControls.zoomSpeed = 1.2
    orbitControls.dampingFactor = 0.2
    orbitControls.minDistance = 10
    orbitControls.maxDistance = 500
    orbitControls.enablePan = false
    orbitControls.enabled = false

    return orbitControls;
}