import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Objeto } from "./Objeto.js";
import { Objeto2 } from "./Objeto2.js";


class Game {
    constructor() {
        //PATHS
        const assetsPath = "../assets/";

        //Loaders
        const textureLoader = new THREE.TextureLoader();
        const fbxLoader = new FBXLoader();
        const gltfLoader = new GLTFLoader();

        //Scene
        this.backgroundColor = new THREE.Color("#34495E");
        this.scene = new THREE.Scene();
        this.scene.background = this.backgroundColor;

        //Camera
        this.cameraPosition = new THREE.Vector3(-800, 600, 800);
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight);
        this.camera.position.set(this.cameraPosition.x, this.cameraPosition.y, this.cameraPosition.z);
        this.camera.near = 0.1;
        this.camera.far = 5000;
        this.camera.updateProjectionMatrix();

        //Renderer
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        //Lights
        //AmbientLight
        this.ambientLight = new THREE.AmbientLight(0x999999);
        this.scene.add(this.ambientLight);

        //DirectionalLight
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        this.directionalLight.position.set(20, 200, 10); 
        this.directionalLight.target.position.set(0, 0, 0);
        this.directionalLight.castShadow = true;
        //Propiedades de sombra 
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.bias = -0.001;
        this.directionalLight.shadow.camera.near = 0.1;
        this.directionalLight.shadow.camera.far = 2000.0;
        this.directionalLight.shadow.camera.left = -2000;
        this.directionalLight.shadow.camera.right = 2000;
        this.directionalLight.shadow.camera.top = 2000;
        this.directionalLight.shadow.camera.bottom = -2000;
        this.scene.add(this.directionalLight);

        //Cielo
        this.skydomeSize = new THREE.Vector3(2000, 25, 25);
        const sphereGeometry = new THREE.SphereGeometry(this.skydomeSize.x, this.skydomeSize.y, this.skydomeSize.z);
        this.miCielo = textureLoader.load(`${assetsPath}texturas/cielo.jpg`);
        const sphereMaterial = new THREE.MeshPhongMaterial({
            map: this.miCielo
        });
        this.sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.sphere.material.side = THREE.BackSide;
        this.scene.add(this.sphere);

        //Terreno
        this.planeTexture = textureLoader.load(`${assetsPath}texturas/suelo.jpg`);
        this.planeTexture.wrapS = this.planeTexture.wrapT = THREE.RepeatWrapping;
        this.planeTexture.repeat.set(10, 10);
        this.planeGeometry = new THREE.PlaneGeometry(2000, 2000, 10, 10);
        this.planeMaterial = new THREE.MeshStandardMaterial({ map: this.planeTexture, roughness: 1 });
        this.planeMaterial.shadowDarkness = 1;

        this.plane = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
        this.plane.rotation.x = -Math.PI / 2;
        this.plane.position.set(0, 0, 0);
        this.plane.receiveShadow = true;

        this.scene.add(this.plane);

        //Un cubo
        const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        const cubeMaterial = new THREE.MeshPhongMaterial({ color: 0x00aaff });
        this.cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        this.cube.scale.set(1, 1, 1);
        this.scene.add(this.cube);

        //Orbit
        const cameraControl = new OrbitControls(this.camera, this.renderer.domElement);

        //Cantidad de Huevos de Dinosaurio
        const huevos = new Array(10);

        //T-Rex
        const rexy = new Objeto2(`${assetsPath}modelos/Rexy/scene.gltf`, this.scene, new THREE.Vector3(22, 22, 22), new THREE.Vector3(30, 0, -20));
        const model = rexy.getModel();

        console.log(model);

        delete rexy(this.scene, model);


        //const rexy = new Objeto(gltfLoader, this.scene, `${assetsPath}modelos/Rexy/scene.gltf`, new THREE.Vector3(22, 22, 22), new THREE.Vector3(30, 0, -20));
        //console.dir(rexy);
        //rexy.grita();

        this.animate();
    }
    
    animate() {
        const game = this;

        requestAnimationFrame(function () { game.animate(); });

        this.renderer.render(this.scene, this.camera);
    }

    cargarGLTF(gltfLoader, scene, rutaModelo, escala, posicion) {
        var result, model, boundingbox, helper;

        gltfLoader.load(rutaModelo, function (gltf) {
            let obj = gltf.scene;
            obj.scale.set(escala.x, escala.y, escala.z);
            obj.position.set(posicion.x, posicion.y, posicion.z);

            obj.traverse(function (node) {
                if (node.isMesh) {
                    node.castShadow = true;
                    obj.receiveShadow = true;
                }
            });
            scene.add(obj);
            model = obj;

            boundingbox = new THREE.Box3().setFromObject(obj);
            helper = new THREE.Box3Helper(boundingbox, 0xffff00);

            //Actualizar el Helper del Bounding Box
            boundingbox.setFromObject(obj);
            const center = boundingbox.getCenter(new THREE.Vector3());
            const size = boundingbox.getSize(new THREE.Vector3());
            helper.position.copy(center);
            helper.scale.set(size.x, size.y, size.z);

            scene.add(helper);

        },
            function (xhr) {

                console.log(result);
            });

        console.log(result);
        return model;

    }
}

document.addEventListener("DOMContentLoaded", function () {
    const game = new Game();
    window.game = game;
});