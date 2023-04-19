import * as THREE from 'three';
import * as CANNON from "cannon-es";
import CannonDebugger from 'cannon-es-debugger';

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { Objeto } from "./Objeto.js";

//PATHS
let assetsPath;

//Loaders
let textureLoader;

//Scene
let scene;

//Preparar el Mundo Fisico
let physicsWorld;
let groundBody;
let cannonDebugger;
//Objetos Fisicos
let sphereBody;
let esfera;

//Camara
let cameraPosition;
let camera;

//Renderer
let renderer;

//Lights
let ambientLight;
let directionalLight;

//Cielo
let skydomeSize;

//Terreno

//Orbit
let cameraControl;
init();

async function init() {
    //locacion de Assets
    assetsPath = "../assets/";

    //Loaders
    textureLoader = new THREE.TextureLoader();

    //Scene
    const backgroundColor = new THREE.Color("#34495E");
    scene = new THREE.Scene();
    scene.background = backgroundColor;

    setupCannon();
    setupCamera();
    setupRenderer();
    setupLights()
    setupSkyDome();
    setupTerreno();

    //Orbit
    cameraControl = new OrbitControls(camera, renderer.domElement);

    cargarModelos();

    animate();
}

function animate() {
    physicsWorld.fixedStep();
    cannonDebugger.update();

    esfera.position.copy(sphereBody.position);
    esfera.quaternion.copy(sphereBody.quaternion);

    requestAnimationFrame(function () { animate(); });

    renderer.render(scene, camera);
}

function cargarModelos() {
    //Objetos
    //Carro
    const carro = new Objeto(
        scene,
        physicsWorld,
        `${assetsPath}modelos/Carro/carro.gltf`,
        new THREE.Vector3(22, 22, 22),
        new THREE.Vector3(-650, 0, 800),
        new THREE.Vector3(0, 0, 0)
    );

    //Edificios
    const labModel = new Objeto(
        scene,
        physicsWorld,
        `${assetsPath}modelos/Edificios/Lab.fbx`,
        new THREE.Vector3(5, 5, 5),
        new THREE.Vector3(-800, 0, 800),
        new THREE.Vector3(0, Math.PI / 2, 0)
    );

    const museo = new Objeto(
        scene,
        physicsWorld,
        `${assetsPath}modelos/Edificios/Museo.fbx`,
        new THREE.Vector3(5, 5, 5),
        new THREE.Vector3(800, 0, -600),
        new THREE.Vector3(0, Math.PI / 90, 0)
    );

    const cabin = new Objeto(
        scene,
        physicsWorld,
        `${assetsPath}modelos/Cabin.fbx`,
        new THREE.Vector3(2, 2, 2),
        new THREE.Vector3(-80, 0, -200),
        new THREE.Vector3(0, Math.PI / 90, 0)
    );

    //Traps
    const trampa = new Objeto(
        scene,
        physicsWorld,
        `${assetsPath}modelos/Trampa.fbx`,
        new THREE.Vector3(22, 22, 22),
        new THREE.Vector3(800, 0, 800),
        new THREE.Vector3(0, Math.PI / 90, 0)
    );

    //Cantidad de Huevos de Dinosaurio
    const huevos = new Array(10);

    //Huevo
    const huevo = new Objeto(
        scene,
        physicsWorld,
        `${assetsPath}modelos/Huevo.fbx`,
        new THREE.Vector3(5, 5, 5),
        new THREE.Vector3(-800, 0, -800),
        new THREE.Vector3(0, 0, 0)
    );

    //T-Rex
    const rexy = new Objeto(
        scene,
        physicsWorld,
        `${assetsPath}modelos/Rexy/scene.gltf`,
        new THREE.Vector3(22, 22, 22),
        new THREE.Vector3(30, 0, -20),
        new THREE.Vector3(0, 0, 0)
    );
}

function setupTerreno() {
    let planeTexture = textureLoader.load(`${assetsPath}texturas/suelo.jpg`);
    planeTexture.wrapS = planeTexture.wrapT = THREE.RepeatWrapping;
    planeTexture.repeat.set(10, 10);
    const planeGeometry = new THREE.PlaneGeometry(2000, 2000, 10, 10);
    let planeMaterial = new THREE.MeshStandardMaterial({ map: planeTexture, roughness: 1 });
    planeMaterial.shadowDarkness = 1;

    let plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, 0, 0);
    plane.receiveShadow = true;

    scene.add(plane);
}

function setupSkyDome() {
    skydomeSize = new THREE.Vector3(2000, 25, 25);
    const sphereGeometry = new THREE.SphereGeometry(skydomeSize.x, skydomeSize.y, skydomeSize.z);
    const miCielo = textureLoader.load(`${assetsPath}texturas/cielo.jpg`);
    const sphereMaterial = new THREE.MeshPhongMaterial({
        map: miCielo
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.material.side = THREE.BackSide;
    scene.add(sphere);
}

function setupLights() {
    //AmbientLight
    ambientLight = new THREE.AmbientLight(0x999999);
    scene.add(ambientLight);

    //DirectionalLight
    directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 200, 0);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;

    //Propiedades de sombra 
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.bias = -0.001;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 2000.0;
    directionalLight.shadow.camera.left = -2000;
    directionalLight.shadow.camera.right = 2000;
    directionalLight.shadow.camera.top = 2000;
    directionalLight.shadow.camera.bottom = -2000;
    scene.add(directionalLight);
}

function setupRenderer() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);
}

function setupCamera() {
    cameraPosition = new THREE.Vector3(-800, 600, 800);
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight);
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    camera.near = 0.1;
    camera.far = 5000;
    camera.updateProjectionMatrix();
}

function setupCannon() {
    //Prepara el mundo
    physicsWorld = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0)
    });

    //Prepara el Suelo y agrega
    groundBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane()
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    physicsWorld.addBody(groundBody);

    //Prepara una Esfera
    const radius = 100;
    sphereBody = new CANNON.Body({
        mass: 50,
        shape: new CANNON.Sphere(radius)
    });
    sphereBody.position.set(0, 1000, 0);
    physicsWorld.addBody(sphereBody);

    const esferaGeometry = new THREE.SphereGeometry(radius);
    const esferaMaterial = new THREE.MeshNormalMaterial();
    esfera = new THREE.Mesh(esferaGeometry, esferaMaterial);
    scene.add(esfera);

    //CANNON DEBUGGER
    cannonDebugger = new CannonDebugger(scene, physicsWorld);
}