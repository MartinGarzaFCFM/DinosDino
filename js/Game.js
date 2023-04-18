import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { Objeto } from "./Objeto.js";



class Game {
    constructor() {
        //PATHS
        const assetsPath = "../assets/";

        //Loaders
        const textureLoader = new THREE.TextureLoader();

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
        this.directionalLight.position.set(0, 200, 0);
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

        //Orbit
        const cameraControl = new OrbitControls(this.camera, this.renderer.domElement);

        //Carro
        const carro = new Objeto(
            this.scene, 
            `${assetsPath}modelos/Carro/carro.gltf`, 
            new THREE.Vector3(22, 22, 22), 
            new THREE.Vector3(-650, 0, 800), 
            new THREE.Vector3(0, 0, 0)
            );

        //Edificios
        const labModel = new Objeto(
            this.scene, 
            `${assetsPath}modelos/Edificios/Lab.fbx`, 
            new THREE.Vector3(5, 5, 5), 
            new THREE.Vector3(-800, 0, 800), 
            new THREE.Vector3(0, Math.PI/2, 0)
        );

        const museo = new Objeto(
            this.scene, 
            `${assetsPath}modelos/Edificios/Museo.fbx`, 
            new THREE.Vector3(5, 5, 5), 
            new THREE.Vector3(800, 0, -600), 
            new THREE.Vector3(0, Math.PI/90, 0)
        );

        const cabin = new Objeto(
            this.scene, 
            `${assetsPath}modelos/Cabin.fbx`, 
            new THREE.Vector3(2, 2, 2), 
            new THREE.Vector3(-80, 0, -200), 
            new THREE.Vector3(0, Math.PI/90, 0)
        );

        //Traps
        const trampa = new Objeto(
            this.scene, 
            `${assetsPath}modelos/Trampa.fbx`, 
            new THREE.Vector3(22, 22, 22), 
            new THREE.Vector3(800, 0, 800), 
            new THREE.Vector3(0, Math.PI/90, 0)
        );


        
        //Cantidad de Huevos de Dinosaurio
        const huevos = new Array(10);

        //Huevo
        const huevo = new Objeto(this.scene, 
            `${assetsPath}modelos/Huevo.fbx`, 
            new THREE.Vector3(5, 5, 5), 
            new THREE.Vector3(-800, 0, -800),
            new THREE.Vector3(0, 0, 0)
            );

        //T-Rex
        const rexy = new Objeto(
            this.scene, 
            `${assetsPath}modelos/Rexy/scene.gltf`, 
            new THREE.Vector3(22, 22, 22), 
            new THREE.Vector3(30, 0, -20), 
            new THREE.Vector3(0, 0, 0)
            );

        this.animate();
        console.dir(this.scene);
    }

    animate() {
        const game = this;

        requestAnimationFrame(function () { game.animate(); });

        this.renderer.render(this.scene, this.camera);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const game = new Game();
    window.game = game;
});