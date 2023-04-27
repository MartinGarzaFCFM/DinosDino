import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onChildAdded, onChildChanged, child, get } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

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
var usuariosRef;
var userUID;
var partidaRef;

//Datos
export var usuarioConectado = null;
export var usuarios = [];

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

function prepareRefs(){
    usuariosRef = ref(db, "Usuarios/")
}

function lookForGame(){
    const dbRef = ref(getDatabase());
    get(child(dbRef, "Juego/")).then((snapshot) => {
        if(snapshot.exists() && snapshot.val() !== ""){
            console.log("Hay un juego en curso");
            partidaRef = ref(db, "Juego/");
        } else {
            console.log("No hay juegos abiertos");
        }
    }).catch((error) => {
        console.error(error);
    });
}

function prepareEvents() {
    onChildAdded(usuariosRef, (data) =>{
        userUID = data.key;
    });
    onChildChanged(usuariosRef, (data) =>{
        userUID = data.key;
    });
}

function login() {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log(result.user);

            set(ref(db, "Usuarios/" + result.user.uid), {
                connected: true
            });

        }).catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.log(errorCode + " " + errorMessage);
        });
}

function logout() {
    signOut(auth).then(() => {
        set(ref(db, "Usuarios/" + userUID), {
            connected: false
        });
    }).catch((error) => {
        console.log('ERROR ' + error);
    });
}

function createGame() {
    set(ref(db, "Juego/"));
    set(ref(db, "Juego/" + userUID), {
        posX: Math.floor((Math.random() * 800) - 800),
        posZ: Math.floor((Math.random() * 800) - 800),
        rotX: 0,
        rotY: 0,
        rotZ: 0
    });

    partidaRef = ref(db, "Juego/");
}

function joinGame(){

}

//escribe datos en la bdd
function writeUserData(position, rotation) {
    set(ref(this.db, 'partida/jugadores/' + this.user.uid), {
        x: position.x,
        z: position.z,
        rotx: rotation.x,
        roty: rotation.y,
        rotz: rotation.z
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
    writeUserData
}