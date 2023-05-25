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
export var userUID = null;
export var userName = null;
var usuariosRef;
var sala;

//Datos
export var inGameRef = null;
export var usuarioConectado = null;
export var inGameState = false;
export var usuariosEnJuego = {};
export var huevosEnJuego = {};
export var huevosDeUsuarios = {};

//Datos de Juego
export var gameState = "";
export var difficulty = "Medium";
export var cantidadHuevos = 0;
export var playerPosition = null;
export var playerRotation = null;
export var uidGanador;
export var usuarioGanador;
export var huevosRecogidos = 0;

function init() {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    auth.languageCode = 'es';
    provider = new GoogleAuthProvider();

    prepareRefs();
    prepareEvents();
    prepareScores();
    lookForGame();
}

export function changeDifficulty(key) {
    switch (key) {
        case "Easy":
            difficulty = key;
            break;
        case "Medium":
            difficulty = key;
            break;
        case "Hard":
            difficulty = key;
            break;

        default:
            break;
    }
}

function prepareRefs() {
    usuariosRef = ref(db, "Usuarios/");
}

function lookForGame() {
    const dbRef = ref(getDatabase());
    get(child(dbRef, "Juegos/")).then((snapshot) => {
        if (snapshot.hasChildren()) {
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

    /*
    onChildAdded(usuariosRef, (data) => {
        userUID = data.key;
    });
    onChildChanged(usuariosRef, (data) => {
        userUID = data.key;
    });
    
    */

}

function prepareScores(){
    onValue(ref(db, "Usuarios/"), (snapshot) => {
        huevosDeUsuarios = snapshot.val();
    });
}

function login(btnCreateGame, btnJoinGame) {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log(result.user);
            userUID = result.user.uid;
            userName = result.user.displayName;
            update(ref(db, "Usuarios/" + userUID), {
                name: userName,
                connected: true,
                inGame: false
            });
            usuarioConectado = true;
            btnCreateGame.style.display = "block";
            btnJoinGame.style.display = "block";

        }).catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.log(errorCode + " " + errorMessage);
        });
}

function logout(btnStartGame, btnLeaveGame) {
    if (inGameRef != null) {
        btnStartGame.style.display = "none";
        leaveGame(btnStartGame, btnLeaveGame);
    }
    signOut(auth).then(() => {
        update(ref(db, "Usuarios/" + userUID), {
            connected: false,
            inGame: false
        });
    }).catch((error) => {
        console.log('ERROR ' + error);
    });
    usuarioConectado = false;
}

function createGame(btnStartGame, btnLeaveGame) {
    do {
        sala = prompt("Nombra la sala de espera: ");
    } while (sala === "" || sala === null);

    update(ref(db, "Usuarios/" + userUID), {
        inGame: true
    });
    inGameState = true;

    set(ref(db, "Juegos/" + sala + "/" + "Jugadores/" + userUID), {
        uid: userUID,
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
    set(ref(db, "Juegos/" + sala + "/GameState"), {
        gameState: "EnEspera",
        difficulty: difficulty
    });

    inGameRef = ref(db, "Juegos/" + sala + "/" + "Jugadores/");

    //Actualizar los datos locales con las posiciones de los jugadores
    onValue(inGameRef, (snapshot) => {
        usuariosEnJuego = snapshot.val();
    });

    //Preparar los Huevos collecionables
    //Generar la cantidad de Huevos
    let max = 3;
    let min = 1;
    let huevosTotales = Math.floor(Math.random() * (max - min + 1) + min);

    for (let huevo = 0; huevo <= huevosTotales; huevo++) {
        update(ref(db, "Juegos/" + sala + "/" + "Huevos/" + huevo), {
            huevoID: huevo,
            isCollected: 0,
            posX: (Math.random() * (1000 - -1000) + -1000).toFixed(4),
            posZ: (Math.random() * (1000 - -1000) + -1000).toFixed(4)
        });
        cantidadHuevos++;
    }

    //Guardar la cantidad de Huevos creados en Firebase para detectar cuantos hay y cuando se acabaron para determinar ganador.
    update(ref(db, "Juegos/" + sala + "/GameState"), {
        TotalHuevos: cantidadHuevos
    });

    //Detectar el cambio en la tabla de Huevos
    onValue(ref(db, "Juegos/" + sala + "/Huevos"), (snapshot) => {
        huevosEnJuego = snapshot.val();
    });

    //Detectar si el Juego ha empezado
    onValue(ref(db, "Juegos/" + sala + "/GameState"), (snapshot) => {
        gameState = snapshot.val();
        cantidadHuevos = gameState.TotalHuevos;
        gameState = gameState.gameState;

        if (cantidadHuevos === 0) {
            buscarGanador();
        }
        console.log("HUEVOS restantes");
        console.log(cantidadHuevos);
    });

    btnStartGame.style.display = "block";
    btnLeaveGame.style.display = "block";
}

function joinGame() {
    sala = document.getElementById("selectPartida").value;

    update(ref(db, "Usuarios/" + userUID), {
        inGame: true
    });
    inGameState = true;
    set(ref(db, "Juegos/" + sala + "/" + "Jugadores/" + userUID), {
        uid: userUID,
        gameState: "EnEspera",
        posX: Math.floor((Math.random() * 800) - 800),
        posZ: Math.floor((Math.random() * 800) - 800),
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        hp: 5,
        points: 0
    });
    inGameRef = ref(db, "Juegos/" + sala + "/" + "Jugadores/");

    //Actualizar los datos locales con las posiciones de los jugadores
    onValue(inGameRef, (snapshot) => {
        usuariosEnJuego = snapshot.val();
    });

    //Detectar si el Juego ha empezado
    onValue(ref(db, "Juegos/" + sala + "/GameState"), (snapshot) => {
        gameState = snapshot.val();
        cantidadHuevos = gameState.TotalHuevos;
        difficulty = gameState.difficulty;
        gameState = gameState.gameState;

        if (cantidadHuevos === 0) {
            buscarGanador();
        }
        console.log("HUEVOS restantes");
        console.log(cantidadHuevos);
    });

    //Detectar el cambio en la tabla de Huevos
    onValue(ref(db, "Juegos/" + sala + "/Huevos"), (snapshot) => {
        huevosEnJuego = snapshot.val();
    });
}

function startGame() {
    update(ref(db, "Juegos/" + sala + "/" + "GameState"), {
        gameState: "Started"
    });
}

function endingGame() {
    update(ref(db, "Juegos/" + sala + "/" + "GameState"), {
        gameState: "Finishing"
    });
}

function iAmReady() {
    update(ref(db, "Juegos/" + sala + "/" + "Jugadores/" + userUID), {
        gameState: "Listo"
    });
}

function leaveGame(btnStartGame, btnLeaveGame) {

    remove(ref(db, "Juegos/" + sala)).then(() => {
        console.log("Saliste del juego.");
    });
    update(ref(db, "Usuarios/" + userUID), {
        inGame: false
    });
    inGameState = false;
    inGameRef = null;

    btnStartGame.style.display = "none";
    btnLeaveGame.style.display = "none";
}

export function gotEgg(huevoID) {
    update(ref(db, "Juegos/" + sala + "/" + "Huevos/" + huevoID), {
        isCollected: 1
    });

    let puntosActuales = usuariosEnJuego[userUID].points;
    update(ref(db, "Juegos/" + sala + "/" + "Jugadores/" + userUID), {
        points: puntosActuales + 1
    });
    update(ref(db, "Juegos/" + sala + "/" + "GameState/"), {
        TotalHuevos: cantidadHuevos - 1
    });
}

function buscarGanador() {
    huevosRecogidos = 0;
    for (let i = 0; i < Object.keys(usuariosEnJuego).length; i++) {
        let stats = Object.values(usuariosEnJuego)[i];
        if (stats.points > huevosRecogidos) {
            huevosRecogidos = stats.points;
            uidGanador = stats.uid;
        }
    }
    console.log("GANADOR:");
    console.log(uidGanador);
    console.log("Puntos: ");
    console.log(huevosRecogidos);

    console.log(huevosDeUsuarios);
    usuarioGanador = huevosDeUsuarios[uidGanador];
    console.log(usuarioGanador);

    let totalDeHuevos = usuarioGanador.huevosTotales + huevosRecogidos;
    update(ref(db, "Usuarios/" + uidGanador), {
        huevosTotales: totalDeHuevos
    });

    endingGame();
}

//escribe datos en la bdd
function writeUserData(position) {
    update(ref(db, "Juegos/" + sala + "/" + "Jugadores/" + userUID), {
        posX: position.x,
        posZ: position.z
    });
}

function sendOtherData(position, uid) {
    update(ref(db, "Juegos/" + sala + "/" + uid), {
        posX: position.x,
        posZ: position.z
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
    writeUserData,
    sendOtherData,
    startGame,
    iAmReady
}