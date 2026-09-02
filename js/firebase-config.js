// js/firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyDWLIkXikb_ZYAOZxzgI44GQTbJ8eRlw_Y",
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

// Expose instances globally
window.db = firebase.firestore();
window.auth = firebase.auth();
window.storage = firebase.storage();
