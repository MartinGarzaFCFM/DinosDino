import * as THREE from "three";
import * as CANNON from "cannon-es";
import { Objeto } from "./Objeto";
import { modelLoader } from "./loaders/modelLoader";
import * as firebase from "./Firebase";

class Dinosaurio extends Objeto {
    constructor() {
        super();
        this.mixer;
        this.action;
        this.boundingBoxCustomSize = new THREE.Vector3(80, 80, 80);
        this.lastAtk;
    }
    load(scene, posicion, rotacion, escala) {
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
        this.boundingBox = new THREE.Box3().setFromCenterAndSize(this.model.scene.position, this.boundingBoxCustomSize);
        this.boundingBoxHelper = new THREE.Box3Helper(this.boundingBox, 0xffff00);

        //Actualizar el Bounding Box
        const center = this.boundingBox.getCenter(new THREE.Vector3());
        const size = this.boundingBox.getSize(new THREE.Vector3());
        this.boundingBoxHelper.position.copy(center);
        this.boundingBoxHelper.scale.set(size.x, size.y, size.z);

        //scene.add(this.boundingBoxHelper);
    }
    loadAnimations() {
        this.mixer = new THREE.AnimationMixer(this.model.scene);
        const clips = this.model.animations;
        const clip = THREE.AnimationClip.findByName(clips, "Bip001|Take 001|BaseLayer");
        this.action = this.mixer.clipAction(clip);
    }
    perseguir(player, difficultySpeed) {
        this.action.play();

        this.model.scene.lookAt(player.model.position)

        const distancia = this.model.scene.position.distanceTo(player.model.position);
        let subvec = new THREE.Vector3();
        subvec = subvec.subVectors(player.model.position, this.model.scene.position);

        if (distancia < 1000) {
            this.model.scene.position.x += difficultySpeed * 400 * (subvec.x / distancia);
            this.model.scene.position.y += difficultySpeed * 400 * (subvec.y / distancia);
            this.model.scene.position.z += difficultySpeed * 400 * (subvec.z / distancia);
            this.ataca(player);
        }


        this.update();
    }

    ataca(player) {
        if (this.boundingBox.containsBox(player.boundingBox)) {
            let now = Date.now();
            if(now - this.lastAtk < 1000){
                return
            }
            else{
                console.log("HIT");
                firebase.gotDamaged();
                player.cannonBody.applyImpulse(new CANNON.Vec3(-50000));
                this.lastAtk = Date.now();
            }
        }
    }

    update() {
        this.boundingBox.setFromCenterAndSize(this.model.scene.position, this.boundingBoxCustomSize);
    }
}

export async function dinosaurioCrear(rutaModelo) {
    const dinosaurio = new Dinosaurio();
    dinosaurio.model = await modelLoader(rutaModelo);
    return dinosaurio;
}