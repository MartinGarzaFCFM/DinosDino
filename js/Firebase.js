import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onChildAdded, onChildChanged, child, get, onValue, remove, push, update, onChildRemoved } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

import { Carro } from "./Carro.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCddIjH2EdQBJ8TKOhqeu3GKfYIe0L27zg",
    authDomain: "dinos-1ca44.firebaseapp.com",
    databaseURL: "https://dinos-1ca44-default-rtdb.firebaseio.com",
    projectId: "dinos-1ca44",
    storageBucket: "dinos-1ca44.appspot.com",
    messagingSenderId: "143087109647",
    appId: "1:143087109647:web:2703672e7544556a33c57a"
};

//Variables de Inicio
var app;
var auth;
var provider;
var db;

//Referencias a las Bases
var userUID = null;
var usuariosRef;
var partidaRef = null;

//Datos
export var inGameRef = null;
export var usuarioConectado = null;
export var inGameState = false;
export var usuariosEnJuego = [];

//Datos de Juego
export var gameStart = false;
export var playerPosition = null;
export var playerRotation = null;

function init() {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    auth.languageCode = 'es';
    provider = new GoogleAuthProvider();

    prepareRefs();
    prepareEvents();
    lookForGame();
}

function prepareRefs() {
    usuariosRef = ref(db, "Usuarios/");
}

function lookForGame() {
    const dbRef = ref(getDatabase());
    get(child(dbRef, "Juegos/")).then((snapshot) => {
        if (snapshot.hasChildren()) {
            console.log("Hay un juego en curso");
            let selectPartida = document.getElementById("selectPartida");
            selectPartida.innerHTML = "";
            snapshot.forEach(function (snapshot) {
                let opt = document.createElement("option");
                opt.value = snapshot.key;
                opt.innerHTML = snapshot.key;
                selectPartida.appendChild(opt);
            });
        } else {
            console.log("No hay juegos abiertos");
        }
    }).catch((error) => {
        //console.error(error);
    });
}

function prepareEvents() {
    onChildAdded(ref(db, "/"), (data) => {
        lookForGame();
    });

    onChildChanged(ref(db, "/"), (data) => {
        lookForGame();
    });

    onChildRemoved(ref(db, "/"), (data) => {
        lookForGame();
    });

    onChildAdded(usuariosRef, (data) => {
        userUID = data.key;
    });
    onChildChanged(usuariosRef, (data) => {
        userUID = data.key;
    });
}

function login() {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log(result.user);
            set(ref(db, "Usuarios/" + result.user.uid), {
                connected: true,
                inGame: false,
            });
            usuarioConectado = true;

        }).catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.log(errorCode + " " + errorMessage);
        });
}

function logout() {
    if (inGameRef != null) {
        leaveGame();
    }
    signOut(auth).then(() => {
        set(ref(db, "Usuarios/" + userUID), {
            connected: false,
            inGame: false
        });
    }).catch((error) => {
        console.log('ERROR ' + error);
    });
    usuarioConectado = false;
}

function createGame() {
    let sala = prompt("Nombra la sala de espera: ");
    update(ref(db, "Usuarios/" + userUID), {
        inGame: true
    });
    inGameState = true;

    set(ref(db, "Juegos/" + sala + "/" + userUID), {
        userUID: userUID,
        gameState: "EnEspera",
        posX: Math.floor((Math.random() * 800) - 800),
        posZ: Math.floor((Math.random() * 800) - 800),
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        hp: 5,
        points: 0
    });

    //GameStartVar
    set(ref(db, "Juegos/" + sala + "/GameStart"), {
        gameState: "Waiting"
    });

    inGameRef = ref(db, "Juegos/" + sala);

    //Actualizar los datos locales con las posiciones de los jugadores
    onValue(inGameRef, (snapshot) => {
        usuariosEnJuego = [];
        snapshot.forEach(element => {
            usuariosEnJuego.push(element.toJSON());
        });
        console.log("Usuarios en Juego: ");
        console.log(usuariosEnJuego);
    });

    //Detectar si el Juego ha empezado
    onValue(ref(db, "Juegos/" + sala + "/GameStart"), (snapshot) => {
        gameStart = snapshot.value;
    });

}

function joinGame() {
    let selectPartida = document.getElementById("selectPartida");
    console.log(selectPartida.value);
    
    update(ref(db, "Usuarios/" + userUID), {
        inGame: true
    });
    inGameState = true;
    set(ref(db, "Juegos/" + selectPartida.value + "/" + userUID), {
        posX: Math.floor((Math.random() * 800) - 800),
        posZ: Math.floor((Math.random() * 800) - 800),
        rotX: 0,
        rotY: 0,
        rotZ: 0
    });
    inGameRef = ref(db, "Juegos/" + selectPartida.value);
}

function startGame(){

}

function leaveGame() {

    remove(inGameRef).then(() => {
        console.log("Saliste del juego.");
    });
    update(ref(db, "Usuarios/" + userUID), {
        inGame: false
    });
    inGameState = false;
    inGameRef = null;
}

//escribe datos en la bdd
function writeUserData(position) {
    update(ref(db, inGameRef + "/" + userUID), {
        x: position.x,
        z: position.z
    });
}

export {
    init,
    prepareRefs,
    prepareEvents,
    login,
    logout,
    createGame,
    joinGame,
    leaveGame,
    writeUserData
}