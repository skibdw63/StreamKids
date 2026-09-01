// Firebase Project Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDWLiKXikb_ZYAOZxzgI44GQTbJ8eR1w_Y",
  authDomain: "streamkids-app.firebaseapp.com",
  projectId: "streamkids-app",
  storageBucket: "streamkids-app.firebasestorage.app",
  messagingSenderId: "410660159124",
  appId: "1:410660159124:web:2555b51f99de7c60f9fe81"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Attach directly to the global window object
window.auth = firebase.auth();
window.db = firebase.firestore();

// Also export as standard global variables for direct access
var auth = window.auth;
var db = window.db;
