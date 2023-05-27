import * as THREE from "three";
import { Objeto } from "./Objeto";
import { modelLoader } from "./loaders/modelLoader.js";
import * as firebase from "./Firebase.js";

export class Huevo extends Objeto{
    constructor(objeto){
        super();
        this.ID;
        this.collected = false;
        this.isOn = true;
    }
    collect(playerBoundingBox, huevoID){
        if(this.boundingBox.intersectsBox(playerBoundingBox)){
            console.log("HUEVO!")
            this.collected = true;
            firebase.gotEgg(huevoID);
        }
    }
    remove(){
        this.collected = true;
    }
}

export async function huevoCrear(rutaModelo) {
    const huevo = new Huevo();
    huevo.model = await modelLoader(rutaModelo);
    return huevo;
}