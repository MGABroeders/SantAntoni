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
let firebaseStorage;

// Initialize Firebase
function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK niet geladen');
    return false;
  }
  
  firebaseApp = firebase.initializeApp(firebaseConfig);
  firebaseDB = firebase.firestore();
  firebaseAuth = firebase.auth();
  
  // Firebase Storage is optional - only initialize if available
  if (firebase.storage) {
    firebaseStorage = firebase.storage();
    console.log('Firebase Storage succesvol geïnitialiseerd');
  } else {
    console.warn('Firebase Storage SDK niet geladen - foto uploads werken niet');
  }
  
  console.log('Firebase succesvol geïnitialiseerd');
  return true;
}
