import * as THREE from 'three';
import * as CANNON from "cannon-es";
import CannonDebugger from 'cannon-es-debugger';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Objeto } from "./Objeto.js";
import { gltfLoader } from "./loaders/gltfLoader.js";
import { CrearOrbitControls } from './OrbitControls.js';

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
//Materiales Interaccion
let wheelMaterial;
//Objetos Fisicos
let sphereBody;
let esfera;



//Camara
let cameraPosition;
let camera;
//Permitir que siga al jugador
let cameraFollow = true;

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

//Control de Auto
let chassisBody;
let vehicleModel;
let vehicleBB;
let vehicle;


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
    orbitControls = CrearOrbitControls(camera, renderer);

    cargarModelos();

    //ChaseCam
    chaseCam.position.set(10, 2.5, 0);
    chaseCam.rotateY(Math.PI / 2)
    chaseCamPivot.add(chaseCam);


    const gltfData = await gltfLoader();
    vehicleModel = gltfData.scene;
    vehicleModel.scale.set(22, 22, 22);
    vehicleModel.position.set(-650, 10, 800);
    vehicleModel.rotation.set(0, 0, 0);

    
    vehicleModel.traverse(function (node) {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = false;
        }
    });
    scene.add(vehicleModel);
    vehicleModel.add(chaseCamPivot);
    

    vehicleBB = new THREE.Box3().setFromObject(vehicleModel);
    let vehiclehelper = new THREE.Box3Helper(vehicleBB, 0xffff00);

    //Actualizar el Helper del Bounding Box
    vehicleBB.setFromObject(vehicleModel);
    const center = vehicleBB.getCenter(new THREE.Vector3());
    const size = vehicleBB.getSize(new THREE.Vector3());
    //vehiclehelper.position.copy(center);
    //vehiclehelper.scale.set(size.x, size.y, size.z);


    //2doCarro
    const chassisShape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
    chassisBody = new CANNON.Body({ mass: 200 });
    const chassisRotation = new CANNON.Quaternion();
    chassisRotation.setFromEuler(0, -Math.PI / 2, 0);
    chassisBody.addShape(chassisShape);
    chassisBody.position.set(center.x, center.y, center.z);
    chassisBody.quaternion.copy(chassisRotation);
    physicsWorld.addBody(chassisBody);

    const options = {
        radius: size.y / 4,
        directionLocal: new CANNON.Vec3(0, -1, 0),
        suspensionStiffness: 30,
        suspensionRestLength: 0.3,
        frictionSlip: 1.4,
        dampingRelaxation: 2.3,
        dampingCompression: 4.4,
        maxSuspensionForce: 10000,
        rollInfluence: 0.01,
        axleLocal: new CANNON.Vec3(0, 0, 1),
        chassisConnectionPointLocal: new CANNON.Vec3(-1, 0, 1),
        maxSuspensionTravel: 0.3,
        customSlidingRotationalSpeed: -30,
        useCustomSlidingRotationalSpeed: true,
    }



    //Crear Vehiculo
    vehicle = new CANNON.RaycastVehicle({
        chassisBody: chassisBody,
        //indexRightAxis: 0,
        //indexForwardAxis: 1,
        //indexUpAxis: 2
    });

    options.chassisConnectionPointLocal.set(-size.x / 2, -size.y / 2, size.z / 2);
    vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(-size.x / 2, -size.y / 2, -size.z / 2);
    vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(size.x / 2, -size.y / 2, size.z / 2);
    vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(size.x / 2, -size.y / 2, -size.z / 2);
    vehicle.addWheel(options);

    vehicle.addToWorld(physicsWorld);

    const wheelBodies = []
    vehicle.wheelInfos.forEach((wheel) => {
        const cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20)
        const wheelBody = new CANNON.Body({
            mass: 0,
            material: wheelMaterial,
        })
        wheelBody.type = CANNON.Body.KINEMATIC
        wheelBody.collisionFilterGroup = 0 // turn off collisions
        const quaternion = new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0)
        wheelBody.addShape(cylinderShape, new CANNON.Vec3(), quaternion)
        wheelBodies.push(wheelBody)
        //demo.addVisual(wheelBody)
        physicsWorld.addBody(wheelBody)
    })

    //Actualizar Llantas
    physicsWorld.addEventListener('postStep', () => {
        for (let i = 0; i < vehicle.wheelInfos.length; i++) {
            vehicle.updateWheelTransform(i)
            const transform = vehicle.wheelInfos[i].worldTransform
            const wheelBody = wheelBodies[i]
            wheelBody.position.copy(transform.position)
            wheelBody.quaternion.copy(transform.quaternion)
        }
    })

    scene.add(vehiclehelper);

    animate();
}

function animate() {
    physicsWorld.fixedStep();
    cannonDebugger.update();

    //let playerPosition = new THREE.Vector3(chassisBody.position.x, chassisBody.position.y, chassisBody.position.z);
    let playerPosition = chassisBody.Matrix
    let playerRotation = chassisBody.quaternion;
    if (cameraFollow) followPlayer(playerPosition);

    esfera.position.copy(sphereBody.position);
    esfera.quaternion.copy(sphereBody.quaternion);

    vehicleModel.position.copy(chassisBody.position);
    vehicleModel.position.y -= 30
    vehicleModel.quaternion.copy(chassisBody.quaternion);

    vehicleBB.setFromObject(vehicleModel);
    
    requestAnimationFrame(function () { animate(); });
    renderer.render(scene, camera);
}

document.addEventListener('keydown', (event) => {
    const maxSteerVal = 1.0;
    const maxForce = 4000;
    const brakeForce = 100000;

    switch (event.key) {
        case 'w':
        case 'ArrowUp':
            vehicle.applyEngineForce(-maxForce, 2);
            vehicle.applyEngineForce(-maxForce, 3);
            break;

        case 's':
        case 'ArrowDown':
            vehicle.applyEngineForce(maxForce, 2);
            vehicle.applyEngineForce(maxForce, 3);
            break;

        case 'a':
        case 'ArrowLeft':
            vehicle.setSteeringValue(maxSteerVal, 0);
            vehicle.setSteeringValue(maxSteerVal, 1);
            break;

        case 'd':
        case 'ArrowRight':
            vehicle.setSteeringValue(-maxSteerVal, 0);
            vehicle.setSteeringValue(-maxSteerVal, 1);
            break;

        case 'b':
            vehicle.setBrake(brakeForce, 0);
            vehicle.setBrake(brakeForce, 1);
            vehicle.setBrake(brakeForce, 2);
            vehicle.setBrake(brakeForce, 3);
            break;

    }
});

document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'w':
        case 'ArrowUp':
            vehicle.applyEngineForce(0, 2)
            vehicle.applyEngineForce(0, 3)
            break

        case 's':
        case 'ArrowDown':
            vehicle.applyEngineForce(0, 2)
            vehicle.applyEngineForce(0, 3)
            break

        case 'a':
        case 'ArrowLeft':
            vehicle.setSteeringValue(0, 0)
            vehicle.setSteeringValue(0, 1)
            break

        case 'd':
        case 'ArrowRight':
            vehicle.setSteeringValue(0, 0)
            vehicle.setSteeringValue(0, 1)
            break

        case 'b':
            vehicle.setBrake(0, 0)
            vehicle.setBrake(0, 1)
            vehicle.setBrake(0, 2)
            vehicle.setBrake(0, 3)
            break

        case 'g':
            //camera.position.set(0, 800, 0);
            orbitControls.enablePan = !orbitControls.enablePan;
            orbitControls.enabled = !orbitControls.enabled;
            //orbitControls.reset();
            cameraFollow = !cameraFollow;
            break;
    }
});

function followPlayer(carro) {
    let camPos = new THREE.Vector3(), camQuat = new THREE.Quaternion();
    chaseCam.getWorldPosition(camPos);
    camera.position.lerpVectors(camera.position, camPos, 0.1);
    chaseCam.getWorldQuaternion(camQuat);
    camera.quaternion.slerp(camQuat, 0.1);

    //camera.position.lerp(carro, 0.2);
    //camera.position.set(carro.x, carro.y + 30, carro.z - 100);
    //camera.lookAt(carro.x, carro.y + 20, carro.z);
    
}


function cargarModelos() {
    //Objetos
    //Carro
    /*

    */

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
        gravity: new CANNON.Vec3(0, -30, 0),
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
        friction: 0.3,
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



    //Prepara una Esfera
    const radius = 100;
    sphereBody = new CANNON.Body({
        mass: 1,
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