import * as THREE from 'three';
import { modelLoader } from "./loaders/modelLoader.js";

export class Objeto {
    constructor() {
        this.model;
        this.boundingBox;
        this.boundingBoxHelper;
    }

    //Colocar en Escena
    load(scene, posicion, rotacion, escala) {
        this.model.position.set(posicion.x, posicion.y, posicion.z);
        this.model.rotation.set(rotacion.x, rotacion.y, rotacion.z);
        this.model.scale.set(escala.x, escala.y, escala.z);

        this.model.traverse(function (node) {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = false;
            }
        });
        scene.add(this.model);

        //Bounding Box
        this.boundingBox = new THREE.Box3().setFromObject(this.model);
        this.boundingBoxHelper = new THREE.Box3Helper(this.boundingBox, 0xffff00);

        //Actualizar el Bounding Box
        const center = this.boundingBox.getCenter(new THREE.Vector3());
        const size = this.boundingBox.getSize(new THREE.Vector3());
        this.boundingBoxHelper.position.copy(center);
        this.boundingBoxHelper.scale.set(size.x, size.y, size.z);

        scene.add(this.boundingBoxHelper);
    }
}

//Funcion a llamar para crear un Objeto, llama el metodo 'load' de la clase para que aparezca.
export async function objetoCrear(rutaModelo) {
    const objeto = new Objeto();
    objeto.model = await modelLoader(rutaModelo);
    return objeto;
}


