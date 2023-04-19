import * as THREE from "three";
import * as CANNON from "cannon-es";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";



export function gltfLoader(scene, physicsWorld, posicion, escala, rotacion) {
    const gltfLoader = new GLTFLoader();
    return new Promise((resolve, reject) => {        
        gltfLoader.load("assets/modelos/Carro/carro.gltf", data => resolve(data), null, reject)
    });
}