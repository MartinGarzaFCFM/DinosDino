import * as THREE from "three";
import { Objeto } from "./Objeto";
import { modelLoader } from "./loaders/modelLoader.js";
import * as firebase from "./Firebase.js";

export class SpeedTire extends Objeto{
    constructor(objeto){
        super();
        this.ID;
        this.collected = false;
        this.isOn = true;
    }
    collect(playerBoundingBox, speedTireID, speedTireCurrentBonus, div){
        if(this.boundingBox.intersectsBox(playerBoundingBox)){
            this.collected = true;
            firebase.gotTire(speedTireID);
            speedTireCurrentBonus += 200;
            let amountBonus = speedTireCurrentBonus / 200;
            div.innerHTML = "Speed: +" + amountBonus;
        }
    }
    remove(){
        this.collected = true;
    }
}

export async function speedTireCrear(rutaModelo) {
    const speedTire = new SpeedTire();
    speedTire.model = await modelLoader(rutaModelo);
    return speedTire;
}