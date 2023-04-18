import * as THREE from 'three';

export class Objeto {
    constructor(gltfLoader, scene, rutaModelo, escala, posicion) {
        this.obj;
        this.modelo;
        this.boundingBox;
        this.helper;

        const getModel = this.loadModel(rutaModelo, gltfLoader);
        this.modelo = getModel();

        
        gltfLoader.load(rutaModelo, function (gltf) {
            var obj = gltf.scene;
            obj.scale.set(escala.x, escala.y, escala.z);
            obj.position.set(posicion.x, posicion.y, posicion.z);

            obj.traverse(function (node) {
                if (node.isMesh) {
                    node.castShadow = true;
                    obj.receiveShadow = true;
                }
            });
            scene.add(obj);
            //modelo = this.obj;

            var boundingbox = new THREE.Box3().setFromObject(obj);
            var helper = new THREE.Box3Helper(boundingbox, 0xffff00);

            //Actualizar el Helper del Bounding Box
            boundingbox.setFromObject(obj);
            const center = boundingbox.getCenter(new THREE.Vector3());
            const size = boundingbox.getSize(new THREE.Vector3());
            helper.position.copy(center);
            helper.scale.set(size.x, size.y, size.z);

            scene.add(helper);
        });
    }

    loadModel(url, gltfLoader) {
        let model;

        const onLoad = (gltf) => {
            model = gltf.scene;
        };

        gltfLoader.load(url, onLoad);

        return () => model;
    }

    grita() {
        console.dir(this.modelo);
    }

}