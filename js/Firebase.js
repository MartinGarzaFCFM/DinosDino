import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-app.js"
import {
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/9.19.0/firebase-auth.js"

import {
    getDatabase,
    ref,
    onValue,
    set,
    onDisconnect,
    onChildAdded,
    onChildChanged,
    onChildRemoved
} from "https://www.gstatic.com/firebasejs/9.19.0/firebase-database.js"

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

class Firebase {
    constructor() {
        // Initialize Firebase
        this.app = initializeApp(firebaseConfig);
        // Initialize Firebase Authentication and get a reference to the service
        this.auth = getAuth(this.app);
        this.auth.languageCode = 'es';
        this.provider = new GoogleAuthProvider();
        this.db = getDatabase();

        //Referencias a las Bases
        this.usuariosRef = ref(this.db, "Usuarios/");
        this.juegoRef = ref(this.db, "Juego/");

        //Datos propios de la Instancia
        this.user = null;

        this.auth.onAuthStateChanged((user) => {
            this.user = user;
            console.log(user);
        });

        onChildAdded(this.juegoRef, (data) => {
            console.log(data);
        });

        onChildRemoved(this.juegoRef, (data) => {
            console.log(data);
        });


    }

    async login() {
        const resp = await signInWithPopup(this.auth, this.provider)
            .then((result) => {
                // This gives you a Google Access Token. You can use it to access the Google API.
                //const credential = GoogleAuthProvider.credentialFromResult(result);
                //const token = credential.accessToken;
                // The signed-in user info.
                console.log(result.user);

                set(ref(this));

                set(this.usuariosRef + result.user.uid + "/", {
                    connected: true
                });

                // IdP data available using getAdditionalUserInfo(result)
            }).catch((error) => {
                // Handle Errors here.
                const errorCode = error.code;
                const errorMessage = error.message;
                // The email of the user's account used.
                //const email = error.customData.email;
                // The AuthCredential type that was used.
                //const credential = GoogleAuthProvider.credentialFromError(error);
                console.log(errorCode + errorMessage);
            });
    }

    async logout() {
        signOut(this.auth).then(() => {
            set(this.usuariosRef + this.user.uid + "/", {
                connected: false
            });
            this.user = null;
            console.log('SALISTE');
        }).catch((error) => {
            console.log('ERROR' + error);
        });
    }

    async createGame() {
        set(this.juegoRef + "/" + this.user);
    }

    //Leer Datos de la BD
    readAllPlayers() {
        const players = ref(this.db, 'partida/jugadores');
        var playersArray = [];
        onValue(players, (snapshot) => {
            playersArray.push(snapshot.val());
        });
        this.players = playersArray;
    }

    //escribe datos en la bdd
    writeUserData(position, rotation) {
        set(ref(this.db, 'partida/jugadores/' + this.user.uid), {
            x: position.x,
            z: position.z,
            rotx: rotation.x,
            roty: rotation.y,
            rotz: rotation.z
        });
    }
}

export { Firebase };
