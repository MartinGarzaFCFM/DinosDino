import * as THREE from "three";
import { Objeto } from "./Objeto";
import { modelLoader } from "./loaders/modelLoader.js";
import * as firebase from "./Firebase.js";

export class Heart extends Objeto{
    constructor(objeto){
        super();
        this.ID;
        this.collected = false;
        this.isOn = true;
    }
    collect(playerBoundingBox, id){
        if(this.boundingBox.intersectsBox(playerBoundingBox)){
            this.collected = true;
            firebase.gotHeart(id);
        }
    }
    remove(){
        this.collected = true;
    }
}

export async function heartCrear(rutaModelo) {
    const objeto = new Heart();
    objeto.model = await modelLoader(rutaModelo);
    return objeto;
}