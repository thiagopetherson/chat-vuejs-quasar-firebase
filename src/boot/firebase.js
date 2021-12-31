// Firebase App (the cire Firebase SDK) is always required and must be listed first
import firebase from 'firebase/compat/app'

// Add the Firebase products that you want to use
import 'firebase/compat/auth' // Importando a autenticação do firebase
import 'firebase/compat/database' // Importando o tempo real do firebase


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDInk1358eXxir0kSy5uIsZINibx3KpXJA",
  authDomain: "smackchat-f5726.firebaseapp.com",
  projectId: "smackchat-f5726",
  storageBucket: "smackchat-f5726.appspot.com",
  messagingSenderId: "185548056921",
  appId: "1:185548056921:web:4e6acb17e0585f1acc4448"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);    
// let firebaseAuth = firebase.auth()
// let firebaseDb = firebase.database()


// export default { firebaseAuth, firebaseDb }
export default firebase