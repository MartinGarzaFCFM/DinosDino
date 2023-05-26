import * as THREE from "three";
import { Objeto } from "./Objeto";
import { modelLoader } from "./loaders/modelLoader.js";
import * as firebase from "./Firebase.js";

export class Spray extends Objeto{
    constructor(objeto){
        super();
        this.ID;
        this.collected = false;
        this.isOn = true;
    }
    collect(playerBoundingBox, id, trexCurrentSpeed){
        if(this.boundingBox.intersectsBox(playerBoundingBox)){
            this.collected = true;
            firebase.gotSpray(id);
            trexCurrentSpeed -= 0.001;
        }
    }
    remove(){
        this.collected = true;
    }
}

export async function sprayCrear(rutaModelo) {
    const objeto = new Spray();
    objeto.model = await modelLoader(rutaModelo);
    return objeto;
}