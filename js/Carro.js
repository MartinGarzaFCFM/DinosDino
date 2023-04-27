import * as THREE from "three";
import * as CANNON from "cannon-es";
import { Objeto } from "./Objeto";
import { modelLoader } from "./loaders/modelLoader.js";

export class Carro extends Objeto {
    constructor() {
        super();
        this.chaseCam = new THREE.Object3D();
        this.cannonBody;
        this.control;
        this.isON = false;
        this.ID = null;
    }
    load(scene, physicsWorld, posicion, rotacion, wheelMaterial) {
        this.model = this.model.scene;
        //ChaseCam
        const chaseCamPivot = new THREE.Object3D();

        this.chaseCam.position.set(10, 2.5, 0);
        //this.chaseCam.rotateY(Math.PI / 2);
        chaseCamPivot.add(this.chaseCam);

        this.chaseCam.position.set(10, 2.5, 0);
        this.chaseCam.rotateY(Math.PI / 2)
        chaseCamPivot.add(this.chaseCam);

        this.model.position.set(posicion.x, posicion.y, posicion.z);
        this.model.rotation.set(rotacion.x, rotacion.y, rotacion.z);
        this.model.scale.set(4, 4, 4);

        this.model.traverse(function (node) {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = false;
            }
        });
        scene.add(this.model);
        this.model.add(chaseCamPivot)

        //Bounding Box
        this.boundingBox = new THREE.Box3().setFromObject(this.model);
        this.boundingBoxHelper = new THREE.Box3Helper(this.boundingBox, 0xffff00);

        scene.add(this.boundingBoxHelper);

        //Actualizar Helper del Bounding Box
        this.boundingBox.setFromObject(this.model);
        const center = this.boundingBox.getCenter(new THREE.Vector3());
        const size = this.boundingBox.getSize(new THREE.Vector3());

        //Physics
        const chassisShape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
        this.cannonBody = new CANNON.Body({
            mass: 400,

        });
        const chassisRotation = new CANNON.Quaternion();
        chassisRotation.setFromEuler(0, -Math.PI / 2, 0);
        this.cannonBody.addShape(chassisShape);
        this.cannonBody.position.set(center.x, center.y, center.z);
        this.cannonBody.quaternion.copy(chassisRotation);
        physicsWorld.addBody(this.cannonBody);

        //Llantas Properties
        const options = {
            radius: size.y / 3,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 30,
            dampingRelaxation: 2.3,
            dampingCompression: 5.4,
            maxSuspensionForce: 10000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(0, 0, 1),
            chassisConnectionPointLocal: new CANNON.Vec3(-1, 0, 1),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true,
        }

        //Crear Vehiculo
        this.control = new CANNON.RaycastVehicle({
            chassisBody: this.cannonBody,
        });

        options.chassisConnectionPointLocal.set(-size.x / 2, -size.y / 2, size.z / 2);
        this.control.addWheel(options);
        options.chassisConnectionPointLocal.set(-size.x / 2, -size.y / 2, -size.z / 2);
        this.control.addWheel(options);
        options.chassisConnectionPointLocal.set(size.x / 2, -size.y / 2, size.z / 2);
        this.control.addWheel(options);
        options.chassisConnectionPointLocal.set(size.x / 2, -size.y / 2, -size.z / 2);
        this.control.addWheel(options);

        this.control.addToWorld(physicsWorld);

        const wheelBodies = []
        this.control.wheelInfos.forEach((wheel) => {
            const cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20)
            const wheelBody = new CANNON.Body({
                mass: 0.5,
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
            for (let i = 0; i < this.control.wheelInfos.length; i++) {
                this.control.updateWheelTransform(i)
                const transform = this.control.wheelInfos[i].worldTransform
                const wheelBody = wheelBodies[i]
                wheelBody.position.copy(transform.position)
                wheelBody.quaternion.copy(transform.quaternion)
            }
        });
    }

    update() {
        this.model.position.copy(this.cannonBody.position);
        this.model.position.y -= 5.0
        this.model.quaternion.copy(this.cannonBody.quaternion);

        this.boundingBox.setFromObject(this.model);
    }

    updateWithFirebase(posiciones, rotaciones){
        this.model.position.set(posiciones.x, posiciones.y, posiciones.z);
        this.model.position.y -= 5.0;
        this.model.rotation.set(rotaciones.x, rotaciones.y, rotaciones.z);

        this.boundingBox.setFromObject(this.model);
    }
}

export async function carroCrear(rutaModelo) {
    const carro = new Carro();
    carro.model = await modelLoader(rutaModelo);
    return carro;
}