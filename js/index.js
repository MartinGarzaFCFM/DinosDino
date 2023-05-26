import * as THREE from 'three';
import * as CANNON from "cannon-es";
import CannonDebugger from 'cannon-es-debugger';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { huevoCrear } from "./Huevo.js";
import { speedTireCrear } from "./SpeedTire.js";
import { carroCrear } from "./Carro.js";
import { dinosaurioCrear } from "./Dinosaurio.js";
import { edificioCrear } from "./Edificio.js";
import { modelLoader } from './loaders/modelLoader.js';

import * as firebase from "./Firebase.js";
import { sprayCrear } from './Spray.js';
import { heartCrear } from './Heart.js';

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
//Sonidos
var musicON = true;
const listener = new THREE.AudioListener();
const audioLoader = new THREE.AudioLoader();
////Musica
var menuMusic = new THREE.Audio(listener);

////Sonidos SFX
var clickSound = new THREE.Audio(listener);
var carEngineStart = new THREE.Audio(listener);

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
var otrosJugadoresQty = 0;
var otrosJugadores = [];
var posicionesJugadores = {};
var jugadoresCargados = false;

var isPaused = false;

//Valores de Dificultad
var tRexSpeed = 0.015;
var playerSpeed = 5000;


var player = await carroCrear(`${assetsPath}modelos/Carro/carro.gltf`);


//Dinosaurios
var rexy;

var huevos = [];
var posicionesHuevos = {};

//Speed Tires
var speedTireBonus = 0;
var speedTires = [];
var sprays = [];
var hearts = [];
var posicionesSpeedTires = {};
var posicionesSprays = {};
var posicionesHearts = {};

//Firebase
firebase.init();

//Funciones a Botones en HTML
const btnPlay = document.getElementById("btn-Play");
const btnSettings = document.getElementById("btn-Settings");
const btnScores = document.getElementById("btn-Scores");
const btnTutorial = document.getElementById("btn-Tutorial");

//Modales
const modalSettings = document.getElementById("modal-Settings");
const modalPause = document.getElementById("modal-Pause");
const modalScores = document.getElementById("modal-Scores");
const modalScoresClose = document.getElementById("modal-Scores-Close");
const span = document.getElementsByClassName("cerrar")[0];
const tableScores = document.getElementById("ScoreTable");
const modalWinner = document.getElementById("modal-Winner");
const modalLoser = document.getElementById("modal-Loser");
var modalWinnerName = document.getElementById("modal-Winner-Name");

//Switches
const checkboxMusic = document.getElementById("checkbox-Music");
var btnEasyMode = document.getElementById("btn-EasyMode");
var btnMediumMode = document.getElementById("btn-MediumMode");
var btnHardMode = document.getElementById("btn-HardMode");

var btnLevelPark = document.getElementById("btn-LevelPark");
var btnLevelSteel = document.getElementById("btn-LevelSteel");
var btnLevelWoods = document.getElementById("btn-LevelWoods");


//TODO
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-out");
const btnCreateGame = document.getElementById("btn-createGame");
const btnJoinGame = document.getElementById("btn-joinGame");
const btnLeaveGame = document.getElementById("btn-leaveGame");
const btnStartGame = document.getElementById("btn-startGame");
const btnIAmReady = document.getElementById("btn-iAmReady");
const selectPartida = document.getElementById("selectPartida");

//styleStarts
btnCreateGame.style.display = "none";
btnJoinGame.style.display = "none";

//UI Elements Startup
var bonusSpeedDiv;
var healthDiv;
var eggsDiv;

init();
async function init() {
    //window.addEventListener("resize", onWindowResize, false);

    btnPlay.addEventListener("click", () => {
        clickSound.play();

    });
    btnSettings.addEventListener("click", () => {
        clickSound.play();
        modalSettings.style.display = "block";
    });
    btnScores.addEventListener("click", () => {
        clickSound.play();
        modalScores.style.display = "block"
        var table = document.createElement("table");
        let nameHeader = document.createElement("th");
        let eggHeader = document.createElement("th");
        nameHeader.textContent = "Nombre";
        eggHeader.textContent = "Huevos Recolectados"
        table.appendChild(nameHeader);
        table.appendChild(eggHeader);
        for (let i = 0; i < Object.keys(firebase.huevosDeUsuarios).length; i++) {
            let usuario = Object.values(firebase.huevosDeUsuarios)[i];
            console.log(usuario);
            if (usuario.huevosTotales !== undefined) {
                let tr = document.createElement("tr");
                let columnName = document.createElement("td");
                let columnEggs = document.createElement("td");

                let textName = document.createTextNode(usuario.name);
                let textEggs = document.createTextNode(usuario.huevosTotales);

                columnName.appendChild(textName);
                columnEggs.appendChild(textEggs);

                tr.appendChild(columnName);
                tr.appendChild(columnEggs);
                table.appendChild(tr);
            }
        }
        tableScores.appendChild(table);
    });
    btnTutorial.addEventListener("click", () => {
        clickSound.play();

    });

    //Ventanas Modales
    span.addEventListener("click", function () {
        modalSettings.style.display = "none";
    });

    modalScoresClose.addEventListener("click", () => {
        modalScores.style.display = "none";
        tableScores.innerHTML = "";
    });

    window.addEventListener("click", function (event) {
        if (event.target == modalSettings) {
            modalSettings.style.display = "none";
        }
    });

    //CheckBoxes
    checkboxMusic.addEventListener("click", function () {
        musicON ? menuMusic.stop() : menuMusic.play();
        musicON = !musicON;
        checkboxMusic.checked ? true : false;
    });

    ////Dificultades
    btnEasyMode.addEventListener("click", () => {
        firebase.changeDifficulty("Easy");
        btnEasyMode.style.border = "solid";
        btnMediumMode.style.border = "none";
        btnHardMode.style.border = "none";
    });
    btnMediumMode.addEventListener("click", () => {
        firebase.changeDifficulty("Medium");
        btnEasyMode.style.border = "none";
        btnMediumMode.style.border = "solid";
        btnHardMode.style.border = "none";
    });
    btnHardMode.addEventListener("click", () => {
        firebase.changeDifficulty("Hard");
        btnEasyMode.style.border = "none";
        btnMediumMode.style.border = "none";
        btnHardMode.style.border = "solid";
    });

    ////Escenarios
    btnLevelPark.addEventListener("click", () => {
        firebase.changeLevel("Park");
        btnLevelPark.style.border = "solid";
        btnLevelSteel.style.border = "none";
        btnLevelWoods.style.border = "none";
    });
    btnLevelSteel.addEventListener("click", () => {
        firebase.changeLevel("Steel");
        btnLevelPark.style.border = "none";
        btnLevelSteel.style.border = "solid";
        btnLevelWoods.style.border = "none";
    });
    btnLevelWoods.addEventListener("click", () => {
        firebase.changeLevel("Woods");
        btnLevelPark.style.border = "none";
        btnLevelSteel.style.border = "none";
        btnLevelWoods.style.border = "solid";
    });

    btnLogin.addEventListener("click", () => {
        clickSound.play();
        firebase.login(btnCreateGame, btnJoinGame);
    });
    btnLogout.addEventListener("click", async () => {
        clickSound.play();
        firebase.logout(btnStartGame, btnLeaveGame);
    });
    btnCreateGame.addEventListener("click", async () => {
        clickSound.play();
        firebase.createGame();
    });
    btnJoinGame.addEventListener("click", async () => {
        clickSound.play();
        firebase.joinGame();
    });
    btnLeaveGame.addEventListener("click", async () => {
        clickSound.play();
        firebase.leaveGame(btnStartGame, btnLeaveGame);
    });
    btnStartGame.addEventListener("click", async () => {
        clickSound.play();
        firebase.startGame();
    });

    btnIAmReady.addEventListener("click", async () => {
        //Estoy Listo
        await prepararJugadores();
        await prepararHuevos();
        await prepararSpeedTires();
        await prepararSprays();
        await prepararHearts();
        prepararDificultad();
        prepararEscenario();
        setupTerreno();
        player.isON = true;
        firebase.iAmReady();
        carEngineStart.play();
    });

    selectPartida.addEventListener("dblclick", (event) => { firebase.joinGame(); });


    //Scene
    const backgroundColor = new THREE.Color("#34495E");
    scene = new THREE.Scene();
    scene.background = backgroundColor;

    //Loaders
    textureLoader = new THREE.TextureLoader();


    setupCannon();
    setupCamera();
    setupSounds();
    setupRenderer();
    setupLights()
    setupSkyDome();
    setupOrbitCamera();

    await cargarModelos();

    setupUI();

    animate();
}

function animate() {

    physicsWorld.fixedStep();
    cannonDebugger.update();

    if (cameraFollow) followPlayer();


    if (firebase.gameState === "Started") {
        cameraFollow = true;
        if (!isPaused) {
            rexy.perseguir(player, tRexSpeed);
            player.update(firebase);
        }
        else {
            player.pausa(firebase);
        }

        //Leer Vida
        healthDiv.innerHTML = "Vida: " + firebase.hp;

        if (firebase.hp === 0) {
            modalLoser.style.display = "block";
        }

        //Leer Huevos
        eggsDiv.innerHTML = "Huevos Restantes: " + firebase.cantidadHuevos;

        speedTires.forEach((tire) => {
            tire.collect(player.boundingBox, tire.ID, speedTireBonus, bonusSpeedDiv)
            if (tire.collected && tire.isOn) {
                scene.remove(tire.model);
                tire.isOn = false;
                tire.boundingBox.makeEmpty();
            }
        });

        sprays.forEach((spray) => {
            spray.collect(player.boundingBox, spray.ID, tRexSpeed)
            if (spray.collected && spray.isOn) {
                scene.remove(spray.model);
                spray.isOn = false;
                spray.boundingBox.makeEmpty();
            }
        });

        hearts.forEach((heart) => {
            heart.collect(player.boundingBox, heart.ID,)
            if (heart.collected && heart.isOn) {
                scene.remove(heart.model);
                heart.isOn = false;
                heart.boundingBox.makeEmpty();
            }
        });

        huevos.forEach((huevo) => {
            huevo.collect(player.boundingBox, huevo.ID);
            if (huevo.collected && huevo.isOn) {
                scene.remove(huevo.model);
                huevo.isOn = false;
                huevo.boundingBox.makeEmpty();
            }
        });
        if (otrosJugadores.length !== 0) playOthers();
        playSpeedTires();
        playHearts();
        playSprays();
        playHuevos();
    }

    if (firebase.gameState === "Finishing") {
        cameraFollow = false;
        player.update(firebase);
        if (otrosJugadores.length !== 0) playOthers();

        modalWinner.style.display = "block";
        modalWinnerName.innerHTML = firebase.usuarioGanador.name;
    }

    //Reloj aplicado para animaciones
    rexy.mixer.update(clock.getDelta());

    requestAnimationFrame(function () { animate(); });
    renderer.render(scene, camera);

}

async function playOthers() {
    posicionesJugadores = firebase.usuariosEnJuego;

    let keys = Object.keys(posicionesJugadores);

    for (let i = 0; i < keys.length; i++) {
        let posicion = Object.values(posicionesJugadores)[i];
        otrosJugadores.forEach((otro) => {
            if (posicion.uid !== firebase.userUID) {
                otro.model.position.set(posicion.posX, 5, posicion.posZ);
            }
        });
    }
}

async function playHuevos() {
    posicionesHuevos = firebase.huevosEnJuego;

    let keys = Object.keys(posicionesHuevos);

    for (let i = 0; i < keys.length; i++) {
        let posicion = Object.values(posicionesHuevos)[i];
        huevos.forEach((huevo) => {
            if (huevo.ID === posicion.huevoID && posicion.isCollected === 1) {
                huevo.remove();
            }
        });
    }
}

async function playSpeedTires() {
    posicionesSpeedTires = firebase.speedTiresEnJuego;

    let keys = Object.keys(posicionesSpeedTires);

    for (let i = 0; i < keys.length; i++) {
        let posicion = Object.values(posicionesSpeedTires)[i];
        speedTires.forEach((tire) => {
            if (tire.ID === posicion.speedTireID && posicion.isCollected === 1) {
                tire.remove();
            }
        });
    }
}

async function playSprays() {
    posicionesSprays = firebase.spraysEnJuego;

    let keys = Object.keys(posicionesSprays);

    for (let i = 0; i < keys.length; i++) {
        let posicion = Object.values(posicionesSprays)[i];
        sprays.forEach((spray) => {
            if (spray.ID === posicion.ID && posicion.isCollected === 1) {
                spray.remove();
            }
        });
    }
}

async function playHearts() {
    posicionesHearts = firebase.heartsEnJuego;

    let keys = Object.keys(posicionesHearts);

    for (let i = 0; i < keys.length; i++) {
        let posicion = Object.values(posicionesHearts)[i];
        hearts.forEach((heart) => {
            if (heart.ID === posicion.ID && posicion.isCollected === 1) {
                heart.remove();
            }
        });
    }
}

async function prepararJugadores() {
    posicionesJugadores = firebase.usuariosEnJuego;

    for (let i = 0; i < Object.keys(posicionesJugadores).length; i++) {
        let posicion = Object.values(posicionesJugadores)[i];
        console.log(posicion);
        if (posicion.uid !== firebase.userUID) {
            let newCarro = await carroCrear(`${assetsPath}modelos/Carro/carro.gltf`)
            newCarro.ID = posicion.uid;
            newCarro.load(scene, physicsWorld, { x: posicion.posX, y: 10, z: posicion.posZ }, { x: 0, y: 0, z: 0 }, wheelMaterial);
            otrosJugadores.push(newCarro);
        }
        else {
            player.load(scene, physicsWorld, { x: posicion.posX, y: 20, z: posicion.posZ }, { x: 0, y: 0, z: 0 }, wheelMaterial);
        }
    }

    console.log(posicionesJugadores);

    jugadoresCargados = true;
}

async function prepararHuevos() {
    posicionesHuevos = firebase.huevosEnJuego;

    for (let i = 0; i < Object.keys(posicionesHuevos).length; i++) {
        let posicion = Object.values(posicionesHuevos)[i];
        let newHuevo = await huevoCrear(`${assetsPath}modelos/Huevo.fbx`);
        newHuevo.ID = posicion.huevoID;
        newHuevo.load(scene, { x: posicion.posX, y: 0, z: posicion.posZ }, { x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });
        huevos.push(newHuevo);
    }
}

async function prepararSpeedTires() {
    posicionesSpeedTires = firebase.speedTiresEnJuego;

    for (let i = 0; i < Object.keys(posicionesSpeedTires).length; i++) {
        let posicion = Object.values(posicionesSpeedTires)[i];
        let newSpeedTire = await speedTireCrear(`${assetsPath}modelos/tire.fbx`);
        newSpeedTire.ID = posicion.speedTireID;
        newSpeedTire.load(scene, { x: posicion.posX, y: 0, z: posicion.posZ }, { x: 0, y: 0, z: 0 }, { x: 0.1, y: 0.1, z: 0.1 });
        speedTires.push(newSpeedTire);
    }
}

async function prepararSprays() {
    posicionesSprays = firebase.spraysEnJuego;

    for (let i = 0; i < Object.keys(posicionesSprays).length; i++) {
        let posicion = Object.values(posicionesSprays)[i];
        let newModel = await sprayCrear(`${assetsPath}modelos/Spray.fbx`);
        newModel.ID = posicion.ID;
        newModel.load(scene, { x: posicion.posX, y: 0, z: posicion.posZ }, { x: 0, y: 0, z: 0 }, { x: 0.1, y: 0.1, z: 0.1 });
        sprays.push(newModel);
    }
}

async function prepararHearts() {
    posicionesHearts = firebase.heartsEnJuego;

    for (let i = 0; i < Object.keys(posicionesHearts).length; i++) {
        let posicion = Object.values(posicionesHearts)[i];
        let newModel = await heartCrear(`${assetsPath}modelos/Heart.fbx`);
        newModel.ID = posicion.ID;
        newModel.load(scene, { x: posicion.posX, y: 0, z: posicion.posZ }, { x: 0, y: 0, z: 0 }, { x: 0.1, y: 0.1, z: 0.1 });
        hearts.push(newModel);
    }
}


async function prepararDificultad() {
    switch (firebase.difficulty) {
        case "Easy":
            tRexSpeed = 0.001
            playerSpeed = 6500
            break;
        case "Medium":
            tRexSpeed = 0.0015
            playerSpeed = 6000
            break;
        case "Hard":
            tRexSpeed = 0.002
            playerSpeed = 5500
            break;
        default:
            break;
    }
}

async function prepararEscenario() {
    switch (firebase.level) {
        case "Park":
            setupPark();
            break;

        case "Steel":
            setupSteel();
            break;

        case "Woods":
            setupWoods();
            break;

        default:
            break;
    }
}

document.addEventListener('keydown', (event) => {
    const maxSteerVal = 0.9;
    const brakeForce = 200;

    switch (event.key) {
        case 'w':
        case 'ArrowUp':
            player.control.applyEngineForce(-playerSpeed + speedTireBonus, 2);
            player.control.applyEngineForce(-playerSpeed + speedTireBonus, 3);
            break;

        case 's':
        case 'ArrowDown':
            player.control.applyEngineForce(playerSpeed + speedTireBonus, 2);
            player.control.applyEngineForce(playerSpeed + speedTireBonus, 3);
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

        case 'p':
            isPaused = !isPaused;
            isPaused ? modalPause.style.display = "block" : modalPause.style.display = "none";
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
    //Dinosaurios
    rexy = await dinosaurioCrear(`${assetsPath}modelos/Rexy/Rexy.gltf`);
    rexy.load(
        scene,
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 2, y: 2, z: 2 }
    );
    rexy.loadAnimations();
}

async function setupPark() {
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
}

async function setupSteel() {
    const factory = await edificioCrear(`${assetsPath}modelos/Factory.fbx`);
    factory.load(
        scene,
        physicsWorld,
        { x: -80, y: 0, z: -200 },
        { x: 0, y: Math.PI / 90, z: 0 },
        { x: 1, y: 1, z: 1 }
    );

    const factory2 = await edificioCrear(`${assetsPath}modelos/Factory2.fbx`);
    factory2.load(
        scene,
        physicsWorld,
        { x: 80, y: 0, z: 200 },
        { x: 0, y: Math.PI / 90, z: 0 },
        { x: 1, y: 1, z: 1 }
    );
}

async function setupWoods() {
    const casabosque = await edificioCrear(`${assetsPath}modelos/Factory2.fbx`);
    casabosque.load(
        scene,
        physicsWorld,
        { x: 80, y: 0, z: 200 },
        { x: 0, y: Math.PI / 90, z: 0 },
        { x: 1, y: 1, z: 1 }
    );
}

function setupTerreno() {
    let planeTexture;
    switch (firebase.level) {
        case "Park":
            planeTexture = textureLoader.load(`${assetsPath}texturas/suelo.jpg`);
            break;
        case "Steel":
            planeTexture = textureLoader.load(`${assetsPath}texturas/metal_plate_diff_1k.jpg`);
            break;
        case "Woods":
            planeTexture = textureLoader.load(`${assetsPath}texturas/coast_sand_rocks_02_diff_1k.jpg`);
            break;

        default:
            break;
    }
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

function setupOrbitCamera() {
    //Orbit
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.rotateSpeed = 1.0;
    orbitControls.zoomSpeed = 1.2;
    orbitControls.dampingFactor = 0.2;
    orbitControls.minDistance = 10;
    orbitControls.maxDistance = 500;
    orbitControls.enablePan = false
    orbitControls.enabled = true;
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
    let canvasDiv = document.getElementById("game");
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(720, 480);
    renderer.shadowMap.enabled = true;
    canvasDiv.replaceWith(renderer.domElement)
}

function setupUI() {
    //UI del JUEGO
    let gameCanvas = document.getElementById("gameScreen");
    const divHP = document.createElement("div");
    divHP.id = "HP";
    divHP.innerText = "Vida: 5";
    gameCanvas.appendChild(divHP);

    //BonusSpeed
    const divBonusSpeed = document.createElement("div");
    divBonusSpeed.id = "div-BonusSpeed";
    divBonusSpeed.innerText = "Speed: 0";
    gameCanvas.appendChild(divBonusSpeed);

    //HuevosRestantes
    const divHuevosRestantes = document.createElement("div");
    divHuevosRestantes.id = "div-HuevosRestantes";
    divHuevosRestantes.innerText = "Huevos Restantes: 0";
    gameCanvas.appendChild(divHuevosRestantes);

    healthDiv = document.getElementById("HP");
    bonusSpeedDiv = document.getElementById("div-BonusSpeed");
    eggsDiv = document.getElementById("div-HuevosRestantes");

}

function setupCamera() {
    cameraPosition = new THREE.Vector3(-800, 600, 800);
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight);
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    camera.near = 0.1;
    camera.far = 5000;
    camera.updateProjectionMatrix();
}

function setupSounds() {
    //Musica de Menu
    audioLoader.load("../assets/musica/jungleTribal.mp3", function (buffer) {
        menuMusic.setBuffer(buffer);
        menuMusic.setLoop(true);
        menuMusic.setVolume(0.1);
        menuMusic.play();
    });

    //clicks
    audioLoader.load("../assets/sonidos/click.wav", function (buffer) {
        clickSound.setBuffer(buffer);
        clickSound.setVolume(0.2);
    });

    //Encendido de Auto
    audioLoader.load("../assets/sonidos/car-engine-start.wav", function (buffer) {
        carEngineStart.setBuffer(buffer);
        carEngineStart.setVolume(0.9);
    });
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
    cannonDebugger = new CannonDebugger(scene, physicsWorld, {
        onInit(body, mesh){
            document.addEventListener("keyup", (event) => {
                if (event.key === '0'){
                    mesh.visible = !mesh.visible;
                }
            });
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
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