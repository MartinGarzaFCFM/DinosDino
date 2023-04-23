import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export async function modelLoader(rutaModelo) {
    const extension = rutaModelo.split('.').pop();
    switch (extension.toLowerCase()) {
        case "gltf":
            const gltfLoader = new GLTFLoader();
            return new Promise((resolve, reject) => {
                gltfLoader.load(rutaModelo, data => resolve(data), null, reject);
            });
            break;

        case "fbx":
            const fbxLoader = new FBXLoader();
            return new Promise((resolve, reject) => {
                fbxLoader.load(rutaModelo, data => resolve(data), null, reject);
            });
            break;

        default:
            break;
    }

}