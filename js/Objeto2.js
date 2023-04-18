import * as THREE from 'three';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";


export class Objeto2 {
    constructor(url, scene, escala, posicion) {
        const loader = new GLTFLoader();

        let model;
        const onLoad = (gltf) => {
            model = gltf.scene;
            model.scale.set(escala.x, escala.y, escala.z);
            model.position.set(posicion.x, posicion.y, posicion.z);

            model.castShadow = true;
            model.receiveShadow = true;

            model.traverse(function (node) {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            // add the loaded model to the scene
            scene.add(model);
        };
        loader.load(url, onLoad);

        this.getModel = () => model;
    }

    destructor(scene, model){
        scene.remove(model);
    }
}