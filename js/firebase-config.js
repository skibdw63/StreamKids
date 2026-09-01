// Firebase Initialization
const firebaseConfig = {
  apiKey: "AIzaSyDWLIkXikb_ZYAOZxzgI44GQTBJ8eRlW_Y",
  authDomain: "streamkids-app.firebaseapp.com",
  projectId: "streamkids-app",
  storageBucket: "streamkids-app.firebasestorage.app",
  messagingSenderId: "410660159124",
  appId: "1:410660159124:web:2555b51f99de7c60f9fe81"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
