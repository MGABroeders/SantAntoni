// Firebase configuration voor Familie Sant Antoni

const firebaseConfig = {
  apiKey: "AIzaSyC_tcxBKIyW5Ciug8_CWLOOg608IeuJVHc",
  authDomain: "familie-sant-antoni.firebaseapp.com",
  projectId: "familie-sant-antoni",
  storageBucket: "familie-sant-antoni.firebasestorage.app",
  messagingSenderId: "666385525123",
  appId: "1:666385525123:web:7ff210e625072d13742eb6"
};

// Deze variabelen worden gevuld zodra Firebase geladen is
let firebaseApp;
let firebaseDB;
let firebaseAuth;

// Initialize Firebase
function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK niet geladen');
    return false;
  }
  
  firebaseApp = firebase.initializeApp(firebaseConfig);
  firebaseDB = firebase.firestore();
  firebaseAuth = firebase.auth();
  console.log('Firebase succesvol geïnitialiseerd');
  return true;
}
