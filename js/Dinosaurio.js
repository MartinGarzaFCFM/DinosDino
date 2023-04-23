import * as THREE from "three";
import { Objeto } from "./Objeto";
import { modelLoader } from "./loaders/modelLoader";

class Dinosaurio extends Objeto {
    constructor() {
        super();
        this.mixer;
        this.action;
        this.raycaster = new THREE.Raycaster();
        this.search = [];
        this.lag = 1;
        this.positionMesh = new THREE.Mesh();
    }
    load(scene, posicion, rotacion, escala) {
        for (let i = 0; i < 180; i += 3) {
            this.search[i] = new THREE.Vector3(Math.cos(i), 0, Math.sin(i));
        }


        this.model.scene.position.set(posicion.x, posicion.y, posicion.z);
        this.model.scene.rotation.set(rotacion.x, rotacion.y, rotacion.z);
        this.model.scene.scale.set(escala.x, escala.y, escala.z);

        this.model.scene.traverse(function (node) {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = false;
            }
        });
        scene.add(this.model.scene);

        //Bounding Box
        this.boundingBox = new THREE.Box3().setFromObject(this.model.scene);
        this.boundingBoxHelper = new THREE.Box3Helper(this.boundingBox, 0xffff00);

        //Actualizar el Bounding Box
        const center = this.boundingBox.getCenter(new THREE.Vector3());
        const size = this.boundingBox.getSize(new THREE.Vector3());
        this.boundingBoxHelper.position.copy(center);
        this.boundingBoxHelper.scale.set(size.x, size.y, size.z);

        scene.add(this.boundingBoxHelper);
    }
    loadAnimations() {
        this.mixer = new THREE.AnimationMixer(this.model.scene);
        const clips = this.model.animations;
        const clip = THREE.AnimationClip.findByName(clips, "Bip001|Take 001|BaseLayer");
        this.action = this.mixer.clipAction(clip);
    }
    perseguir() {
        this.action.play();
    }
}

export async function dinosaurioCrear(rutaModelo) {
    const dinosaurio = new Dinosaurio();
    dinosaurio.model = await modelLoader(rutaModelo);
    return dinosaurio;
}