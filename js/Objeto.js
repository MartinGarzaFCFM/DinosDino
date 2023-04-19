import * as THREE from 'three';
import * as CANNON from "cannon-es";
import CannonDebugger from 'cannon-es-debugger';
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class Objeto {
    constructor(scene, physicsWorld, rutaModelo, escala, posicion, rotacion) {
        const extension = rutaModelo.split('.');

        switch (extension[3].toLowerCase()) {
            case "gltf":
                const gltfLoader = new GLTFLoader();
                gltfLoader.load(rutaModelo, function (gltf) {
                    let obj = gltf.scene;
                    obj.scale.set(escala.x, escala.y, escala.z);
                    obj.position.set(posicion.x, posicion.y, posicion.z);
                    obj.rotation.set(rotacion.x, rotacion.y, rotacion.z);

                    obj.traverse(function (node) {
                        if (node.isMesh) {
                            node.castShadow = true;
                            node.receiveShadow = false;
                        }
                    });
                    scene.add(obj);

                    let boundingbox = new THREE.Box3().setFromObject(obj);
                    let helper = new THREE.Box3Helper(boundingbox, 0xffff00);

                    //Actualizar el Helper del Bounding Box
                    boundingbox.setFromObject(obj);
                    const center = boundingbox.getCenter(new THREE.Vector3());
                    const size = boundingbox.getSize(new THREE.Vector3());
                    helper.position.copy(center);
                    helper.scale.set(size.x, size.y, size.z);

                    //Physics
                    let boxBody = new CANNON.Body({
                        type: CANNON.Body.STATIC,
                        position: new CANNON.Vec3(center.x, center.y, center.z),
                        shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2))
                    });
                    physicsWorld.addBody(boxBody);

                    scene.add(helper);
                },
                    (xhr) => {
                        //console.log("Rex " + (xhr.loaded / xhr.total) * 100 + "% cargado");
                    },
                    (error) => {
                        console.log(error);
                    });

                break;

            case "fbx":
                const fbxLoader = new FBXLoader();
                fbxLoader.load(rutaModelo, function (fbx) {
                    fbx.castShadow = true;
                    fbx.position.set(posicion.x, posicion.y, posicion.z);
                    fbx.rotation.set(rotacion.x, rotacion.y, rotacion.z);
                    fbx.scale.set(escala.x, escala.y, escala.z);

                    fbx.traverse(function (node) {
                        if (node.isMesh) {
                            node.castShadow = true;
                            node.receiveShadow = true;
                        }
                    });
                    scene.add(fbx);


                    let boundingbox = new THREE.Box3().setFromObject(fbx);
                    let helper = new THREE.Box3Helper(boundingbox, 0xffff00);


                    //Actualizar el Helper del Bounding Box
                    boundingbox.setFromObject(fbx);
                    const center = boundingbox.getCenter(new THREE.Vector3());
                    const size = boundingbox.getSize(new THREE.Vector3());
                    helper.position.copy(center);
                    helper.scale.set(size.x, size.y, size.z);

                    //Physics
                    let boxBody = new CANNON.Body({
                        type: CANNON.Body.STATIC,
                        position: new CANNON.Vec3(center.x, center.y, center.z),
                        shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2))
                    });
                    physicsWorld.addBody(boxBody);

                    scene.add(helper);
                },
                    (xhr) => {
                        //console.log((xhr.loaded / xhr.total) * 100 + "% cargado");
                    },
                    (error) => {
                        console.log(error);
                    });

            default:
                break;
        }
    }
}
