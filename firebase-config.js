const firebaseConfig = {
  apiKey: "AIzaSyCfE9jRJrvBJS2UhY6Tc1sLfXqKADMGR7E",
  authDomain: "elegance-studio-971d0.firebaseapp.com",
  projectId: "elegance-studio-971d0",
  storageBucket: "elegance-studio-971d0.firebasestorage.app",
  messagingSenderId: "947260971224",
  appId: "1:947260971224:web:964ee2cb7ba0a53b5e9fad",
  measurementId: "G-3V2K3Q90VP"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Make db and auth globally available
window.db = firebase.firestore();
window.auth = firebase.auth();
