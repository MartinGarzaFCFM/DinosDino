import * as THREE from 'three';
import * as CANNON from "cannon-es";
import CannonDebugger from 'cannon-es-debugger';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Objeto } from "./Objeto.js";
import { gltfLoader } from "./loaders/gltfLoader.js";

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

//Control de Auto
let vehicleModel;
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
    cameraControl = new OrbitControls(camera, renderer.domElement);

    cargarModelos();


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

    let boundingbox = new THREE.Box3().setFromObject(vehicleModel);
    let helper = new THREE.Box3Helper(boundingbox, 0xffff00);

    //Actualizar el Helper del Bounding Box
    boundingbox.setFromObject(vehicleModel);
    const center = boundingbox.getCenter(new THREE.Vector3());
    const size = boundingbox.getSize(new THREE.Vector3());
    helper.position.copy(center);
    helper.scale.set(size.x, size.y, size.z);

    //2doCarro
    //Prepara el Suelo y agrega
    const groundMaterial = new CANNON.Material("groundMaterial");
    const wheelMaterial = new CANNON.Material("wheelMaterial");
    const wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
        friction: 0.3,
        restitution: 1,
        contactEquationStiffness: 1000
    });

    physicsWorld.addContactMaterial(wheelGroundContactMaterial);

    const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
    const chassisBody = new CANNON.Body({ mass: 150, material: groundMaterial });
    chassisBody.addShape(chassisShape);
    chassisBody.position.set(0, 2, 0);
    physicsWorld.addBody(chassisBody);

    const options = {
        radius: 0.5,
        directionLocal: new CANNON.Vec3(0, -1, 0),
        suspensionStiffness: 30,
        suspensionRestLength: 0.3,
        frictionSlip: 5,
        dampingRelaxation: 2.3,
        dampingCompression: 4.4,
        maxSuspensionForce: 100000,
        rollInfluence: 0.01,
        axleLocal: new CANNON.Vec3(-1, 0, -1),
        chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
        maxSuspensionTravel: 0.3,
        customSlidingRotationalSpeed: -30,
        useCustomSlidingRotationalSpeed: true
    };

    //Crear Vehiculo
    vehicle = new CANNON.RaycastVehicle({
        chassisBody: chassisBody,
        indexRightAxis: 0,
        indexUpAxis: 1,
        indexForwardAxis: 2
    });

    options.chassisConnectionPointLocal.set(1, 0, -1);
    vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(-1, 0, -1);
    vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(1, 0, 1);
    vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(-1, 0, 1);
    vehicle.addWheel(options);

    vehicle.addToWorld(physicsWorld);

    const wheelBodies = [];
    vehicle.wheelInfos.forEach(function(wheel){
        const cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20);
        const wheelBody = new CANNON.Body({mass: 1, material: wheelMaterial});
        const q = new CANNON.Quaternion();
        q.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);
        wheelBody.addShape(cylinderShape, new CANNON.Vec3(), q);
        wheelBodies.push(wheelBody);
        physicsWorld.addBody(wheelBody);
    });

    //Actualizar Llantas
    physicsWorld.addEventListener("postStep", function(){
        let index = 0;
        vehicle.wheelInfos.forEach(function(wheel){
            vehicle.updateWheelTransform(index);
            const t = wheel.worldTransform;
            wheelBodies[index].position.copy(t.position);
            wheelBodies[index].quaternion.copy(t.quaternion);
            index++;
        });
    });

    console.log(wheelBodies);

    


    scene.add(helper);

    animate();
}

function animate() {
    physicsWorld.fixedStep();
    cannonDebugger.update();

    esfera.position.copy(sphereBody.position);
    esfera.quaternion.copy(sphereBody.quaternion);

    //vehicleModel.position.copy(vehicleRBody.position);
    //vehicleModel.quaternion.copy(vehicleRBody.quaternion);

    //console.log(vehicleRBody.quaternion);

    



    requestAnimationFrame(function () { animate(); });

    renderer.render(scene, camera);
}

function updateDrive(forward, turn){
    const maxSteerVal = 0.5;
    const maxForce = 1000;
    const brakeForce = 10;

    const force = maxForce * forward;
    const steer = maxSteerVal * turn;

    if (forward!=0){
        vehicle.setBrake(0, 0);
        vehicle.setBrake(0, 1);
        vehicle.setBrake(0, 2);
        vehicle.setBrake(0, 3);

        vehicle.applyEngineForce(force, 2);
        vehicle.applyEngineForce(force, 3);
    }
    else{
        vehicle.setBrake(brakeForce, 0);
        vehicle.setBrake(brakeForce, 1);
        vehicle.setBrake(brakeForce, 2);
        vehicle.setBrake(brakeForce, 3);
    }

    vehicle.setSteeringValue(steer, 0);
    vehicle.setSteeringValue(steer, 1);
}

document.addEventListener('keydown', (event) => {
    const maxSteerVal = Math.PI / 4;
    const maxForce = 50000;

    switch (event.key) {
        case 'w':
        case 'ArrowUp':
            updateDrive(1, 0);
            //vehicleControl.setWheelForce(maxForce, 0);
            //vehicleControl.setWheelForce(maxForce, 1);
            break;

        case 's':
        case 'ArrowDown':
            updateDrive(-1, 0);
            //vehicleControl.setWheelForce(-maxForce / 2, 0);
            //vehicleControl.setWheelForce(-maxForce / 2, 1);
            break;

        case 'a':
        case 'ArrowLeft':
            updateDrive(0, -1);
            //vehicleControl.setSteeringValue(-maxSteerVal, 0);
            //vehicleControl.setSteeringValue(-maxSteerVal, 1);
            break;

        case 'd':
        case 'ArrowRight':
            updateDrive(0, 1);
            //vehicleControl.setSteeringValue(maxSteerVal, 0);
            //vehicleControl.setSteeringValue(maxSteerVal, 1);
            break;
        case ' ':
            console.log("Space");
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'w':
        case 'ArrowUp':
            updateDrive(0, 0);
            //vehicleControl.setWheelForce(0, 0);
            //vehicleControl.setWheelForce(0, 1);
            break;

        case 's':
        case 'ArrowDown':
            updateDrive(0, 0);
            //vehicleControl.setWheelForce(0, 0);
            //vehicleControl.setWheelForce(0, 1);
            break;

        case 'a':
        case 'ArrowLeft':
            updateDrive(0, 0);
            //vehicleControl.setSteeringValue(0, 0);
            //vehicleControl.setSteeringValue(0, 1);
            break;

        case 'd':
        case 'ArrowRight':
            updateDrive(0, 0);
            //vehicleControl.setSteeringValue(0, 0);
            //vehicleControl.setSteeringValue(0, 1);
            break;
    }
});



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
        gravity: new CANNON.Vec3(0, -10, 0),
        broadphase: new CANNON.SAPBroadphase(physicsWorld)
    });

    physicsWorld.defaultContactMaterial.friction = 100;

    


    groundBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
        friction: -1
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