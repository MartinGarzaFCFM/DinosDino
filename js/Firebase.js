import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.0/firebase-app.js"
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/9.19.0/firebase-auth.js"

import {
    getDatabase,
    ref,
    onValue,
    set
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

        this.user = null;
        this.game = null;
        this.players = [];
    }

    async login() {
        const resp = await signInWithPopup(this.auth, this.provider)
            .then((result) => {
                // This gives you a Google Access Token. You can use it to access the Google API.
                const credential = GoogleAuthProvider.credentialFromResult(result);
                const token = credential.accessToken;
                // The signed-in user info.
                this.user = result.user;
                // IdP data available using getAdditionalUserInfo(result)
                //this.createGame();
            }).catch((error) => {
                console.log(error);
            });
    }

    async logout() {
        const resp = await getAuth();

        signOut(this.auth).then(() => {
            console.log('SALISTE');
        }).catch((error) => {
            console.log('ERROR');
        });
    }

    createGame() {
        set(ref(this.db, "partida"), {
        });
    }

    //Buscar si hay un juego
    async findGame() {
        const partida = ref(this.db, "partida/jugadores");
        onValue(partida, (snapshot) => {
            if(snapshot.val() != null){
                this.game = snapshot.val();
                return true;
            }
            else{
                return false;
            }
        });
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
