import * as THREE from "three";
import { Objeto } from "./Objeto";
import { modelLoader } from "./loaders/modelLoader.js";

export class Huevo extends Objeto{
    constructor(objeto){
        super();
        this.collected = false;
    }
    collect(playerBoundingBox){
        if(this.boundingBox.intersectsBox(playerBoundingBox)){
            console.log("HUEVO!")
            this.collected = true;
        }
    }
}

export async function huevoCrear(rutaModelo) {
    const huevo = new Huevo();
    huevo.model = await modelLoader(rutaModelo);
    return huevo;
}