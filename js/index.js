import * as THREE from 'three';
import * as CANNON from "cannon-es";
import CannonDebugger from 'cannon-es-debugger';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { huevoCrear } from "./Huevo.js";
import { carroCrear } from "./Carro.js";
import { dinosaurioCrear } from "./Dinosaurio.js";
import { edificioCrear } from "./Edificio.js";
import { Firebase } from './Firebase.js';

//PATHS
const assetsPath = "../assets/";

//Loaders
let textureLoader;

//Scene
var scene;

//Reloj para las animaciones
const clock = new THREE.Clock();

//Preparar el Mundo Fisico
let physicsWorld;
let groundBody;
let cannonDebugger;
//Materiales Interaccion
let wheelMaterial;




//Camara
let cameraPosition;
let camera;
//Permitir que siga al jugador
let cameraFollow = false;

let chaseCam = new THREE.Object3D();
let chaseCamPivot = new THREE.Object3D();


//Renderer
let renderer;

//Lights
let ambientLight;
let directionalLight;

//Cielo
let skydomeSize;

//Terreno

//Orbit
let orbitControls;

//Jugador
var foundGame;
var otrosJugadores = [];
var otrasPosiciones = [];
var player = await carroCrear(`${assetsPath}modelos/Carro/carro.gltf`);


//Dinosaurios
var rexy;

var huevos;

//Firebase
const firebase = new Firebase();


init();
async function init() {
    //Funciones a Botones en HTML
    //TODO
    const btnLogin = document.getElementById("btn-login");
    const btnLogout = document.getElementById("btn-out");

    btnLogin.addEventListener("click", async () => {
        const user = await firebase.login();
        console.log(firebase.user);
    });

    btnLogout.addEventListener("click", async () => {
        const user = await firebase.logout();
        console.log(firebase.user);
    });


    //Scene
    const backgroundColor = new THREE.Color("#34495E");
    scene = new THREE.Scene();
    scene.background = backgroundColor;

    //Loaders
    textureLoader = new THREE.TextureLoader();


    setupCannon();

    setupCamera();
    setupRenderer();
    setupLights()
    setupSkyDome();
    setupTerreno();

    await firebase.findGame();

    await cargarModelos();
    //Orbit
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.rotateSpeed = 1.0;
    orbitControls.zoomSpeed = 1.2;
    orbitControls.dampingFactor = 0.2;
    orbitControls.minDistance = 10;
    orbitControls.maxDistance = 500;
    orbitControls.enablePan = false
    orbitControls.enabled = true;

    //firebase.readAllPlayers();

    /*
    firebase.game.forEach(jugador => {
        let uid = Object.keys(jugador);
        let playerInstance = player;
        playerInstance.ID = uid;
        others.push(playerInstance);
        //other.load(scene, physicsWorld, {x: jugador.x, y: 0, z: jugador.z}, {x: jugador.rotx, y: jugador.roty, z: jugador.rotz}, wheelMaterial);
    });
    */


    console.log(others);

    animate();
}

function animate() {
    physicsWorld.fixedStep();
    cannonDebugger.update();

    if (cameraFollow) followPlayer();

    if (firebase.user != null) {
        playerStart();
        player.update();
        firebase.writeUserData({ x: player.model.position.x, z: player.model.position.z }, { x: player.model.rotation.x, y: player.model.rotation.y, z: player.model.rotation.z, })
    }



    //rexy.perseguir(player);
    //player.update();

    //huevos.forEach((huevo) => {
    //    huevo.collect(player.boundingBox);
    //    if (huevo.collected) {
    //        scene.remove(huevo.model);
    //        huevo.boundingBox.makeEmpty();
    //    }
    //});




    //Reloj aplicado para animaciones
    rexy.mixer.update(clock.getDelta());

    requestAnimationFrame(function () { animate(); });
    renderer.render(scene, camera);
}

function updateOtherPlayers() {

}

function playerStart() {
    if (player.isON) return;
    player.isON = true;
    //Player
    player.load(
        scene,
        physicsWorld,
        { x: -650, y: 10, z: 800 },
        { x: 0, y: 0, z: 0 },
        wheelMaterial
    );
    cameraFollow = !cameraFollow;

    orbitControls.target.copy(player.model.position);
    orbitControls.update();
}

function showPlayers() {
    firebase.readAllPlayers();
    firebase.players.forEach(function (play) {
        let otro = player;
        otro.ID = play.uid
        others.push(player);
        player.load(scene, physicsWorld, { x: player.x, y: 0, z: player.z }, { x: player.rotx, y: player.roty, z: player.rotz }, wheelMaterial);
    });
}

document.addEventListener('keydown', (event) => {
    const maxSteerVal = 0.9;
    const maxForce = 5000;
    const brakeForce = 200;

    switch (event.key) {
        case 'w':
        case 'ArrowUp':
            player.control.applyEngineForce(-maxForce, 2);
            player.control.applyEngineForce(-maxForce, 3);
            break;

        case 's':
        case 'ArrowDown':
            player.control.applyEngineForce(maxForce, 2);
            player.control.applyEngineForce(maxForce, 3);
            break;

        case 'a':
        case 'ArrowLeft':
            player.control.setSteeringValue(maxSteerVal, 0);
            player.control.setSteeringValue(maxSteerVal, 1);
            break;

        case 'd':
        case 'ArrowRight':
            player.control.setSteeringValue(-maxSteerVal, 0);
            player.control.setSteeringValue(-maxSteerVal, 1);
            break;

        case 'b':
            player.control.setBrake(brakeForce, 0);
            player.control.setBrake(brakeForce, 1);
            player.control.setBrake(brakeForce, 2);
            player.control.setBrake(brakeForce, 3);
            break;

    }
});

document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'w':
        case 'ArrowUp':
            player.control.applyEngineForce(0, 2)
            player.control.applyEngineForce(0, 3)
            break

        case 's':
        case 'ArrowDown':
            player.control.applyEngineForce(0, 2)
            player.control.applyEngineForce(0, 3)
            break

        case 'a':
        case 'ArrowLeft':
            player.control.setSteeringValue(0, 0)
            player.control.setSteeringValue(0, 1)
            break

        case 'd':
        case 'ArrowRight':
            player.control.setSteeringValue(0, 0)
            player.control.setSteeringValue(0, 1)
            break

        case 'b':
            player.control.setBrake(0, 0)
            player.control.setBrake(0, 1)
            player.control.setBrake(0, 2)
            player.control.setBrake(0, 3)
            break

        case 'g':
            //camera.position.set(0, 800, 0);
            orbitControls.enablePan = !orbitControls.enablePan;
            orbitControls.enabled = !orbitControls.enabled;
            orbitControls.target = player.model.position;
            cameraFollow = !cameraFollow;
            break;
    }
});

function followPlayer() {
    let camPos = new THREE.Vector3(), camQuat = new THREE.Quaternion();
    player.chaseCam.getWorldPosition(camPos);
    camera.position.lerpVectors(camera.position, camPos, 0.1);
    player.chaseCam.getWorldQuaternion(camQuat);
    camera.quaternion.slerp(camQuat, 0.1);
}


async function cargarModelos() {
    //Jugadores
    if (firebase.game != null) {
        Object.keys(firebase.game).forEach(key => {
            let playerInst = player;
            playerInst.ID = key;
            otrosJugadores.push(playerInst);
        })
    }

    //Huevos
    huevos = [
        await huevoCrear(`${assetsPath}modelos/Huevo.fbx`),
        await huevoCrear(`${assetsPath}modelos/Huevo.fbx`),
        await huevoCrear(`${assetsPath}modelos/Huevo.fbx`),
    ];
    huevos.forEach((huevo) => {
        let min = -1000;
        let max = 1000;
        let posicionX = (Math.random() * (max - min) + min).toFixed(4);
        let posicionZ = (Math.random() * (max - min) + min).toFixed(4);
        huevo.load(scene, { x: posicionX, y: 0, z: posicionZ }, { x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });
    });

    //Edificios
    const laboratorio = await edificioCrear(`${assetsPath}modelos/Edificios/Lab.fbx`);
    laboratorio.load(
        scene,
        physicsWorld,
        { x: -800, y: 0, z: 800 },
        { x: 0, y: Math.PI / 2, z: 0 },
        { x: 5, y: 5, z: 5 }
    );

    const museo = await edificioCrear(`${assetsPath}modelos/Edificios/Museo.fbx`);
    museo.load(
        scene,
        physicsWorld,
        { x: -800, y: 0, z: -600 },
        { x: 0, y: Math.PI / 2, z: 0 },
        { x: 5, y: 5, z: 5 }
    );

    const cabin = await edificioCrear(`${assetsPath}modelos/Cabin.fbx`);
    cabin.load(
        scene,
        physicsWorld,
        { x: -80, y: 0, z: -200 },
        { x: 0, y: Math.PI / 90, z: 0 },
        { x: 1, y: 1, z: 1 }
    );

    //Dinosaurios
    rexy = await dinosaurioCrear(`${assetsPath}modelos/Rexy/Rexy.gltf`);
    rexy.load(
        scene,
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 2, y: 2, z: 2 }
    );
    rexy.loadAnimations();
    /*
 
    //Traps
    const trampa = new Objeto(
        scene,
        physicsWorld,
        `${assetsPath}modelos/Trampa.fbx`,
        new THREE.Vector3(22, 22, 22),
        new THREE.Vector3(800, 0, 800),
        new THREE.Vector3(0, Math.PI / 90, 0)
    );
    */
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
// window contruct 
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
        gravity: new CANNON.Vec3(0, -20, 0),
        broadphase: new CANNON.SAPBroadphase(physicsWorld)
    });

    physicsWorld.defaultContactMaterial.friction = 0;

    // Add the ground
    const sizeX = 64;
    const sizeZ = 64;
    const matrix = []
    for (let i = 0; i < sizeX; i++) {
        matrix.push([])
        for (let j = 0; j < sizeZ; j++) {
            if (i === 0 || i === sizeX - 1 || j === 0 || j === sizeZ - 1) {
                const height = 3
                matrix[i].push(height)
                continue
            }

            const height = Math.cos((i / sizeX) * Math.PI * 5) * Math.cos((j / sizeZ) * Math.PI * 5) * 2 + 2
            matrix[i].push(height)
        }
    }

    //Prepara el Suelo y agrega
    const groundMaterial = new CANNON.Material('ground');
    const heightfieldShape = new CANNON.Heightfield(matrix, {
        elementSize: 2000 / sizeX,
    })
    const heightfieldBody = new CANNON.Body({ mass: 0, material: groundMaterial, })
    heightfieldBody.addShape(heightfieldShape)
    heightfieldBody.position.set(
        // -((sizeX - 1) * heightfieldShape.elementSize) / 2,
        -(sizeX * heightfieldShape.elementSize) / 2,
        -1,
        // ((sizeZ - 1) * heightfieldShape.elementSize) / 2
        (sizeZ * heightfieldShape.elementSize) / 2
    )
    heightfieldBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    physicsWorld.addBody(heightfieldBody)

    // Define interactions between wheels and ground
    wheelMaterial = new CANNON.Material('wheel');
    const wheel_ground = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
        friction: 0.9,
        restitution: 0,
        contactEquationStiffness: 1000,
    })
    physicsWorld.addContactMaterial(wheel_ground);


    //PRIMER TERRENO
    groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    groundBody.addShape(new CANNON.Plane());
    groundBody.position.set(0, 0, 0);
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    //physicsWorld.addBody(groundBody);



    //CANNON DEBUGGER
    cannonDebugger = new CannonDebugger(scene, physicsWorld);
}

function updateProgress(progress) {
    console.log(`${progress * 100}%`);
    //const progressBar = document.getElementById('progressBar'); // get the progress bar element
    //progressBar.style.width = `${progress * 100}%`; // set the width of the progress bar based on the loading progress
    if (progress === 1) { // check if all assets are loaded
        console.log(`${progress * 100}%`);
        //document.getElementById('loadingScreen').style.display = 'none'; // hide the loading screen
        // display the game or start the game loop
    }
}