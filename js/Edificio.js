import * as THREE from "three";
import * as CANNON from "cannon-es";
import { Objeto } from "./Objeto";
import { modelLoader } from "./loaders/modelLoader";

class Edificio extends Objeto{
    constructor(){
        super();
    }
    load(scene, physicsWorld, posicion, rotacion, escala){
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

        //scene.add(this.boundingBoxHelper);

        //Physics
        const cannonBody = new CANNON.Body({
            type: CANNON.Body.STATIC,
            position: new CANNON.Vec3(center.x, center.y, center.z),
            shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2))
        });

        physicsWorld.addBody(cannonBody);
    }
}

export async function edificioCrear(rutaModelo) {
    const edificio = new Edificio();
    edificio.model = await modelLoader(rutaModelo);
    return edificio;
}