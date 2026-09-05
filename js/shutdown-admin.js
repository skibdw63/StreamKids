// Ensure Firestore is initialized
const db = firebase.firestore();

// 1. Real-time Listener: Syncs shutdown state instantly across ALL viewers
db.collection('system').doc('status').onSnapshot((doc) => {
  const shutdownOverlay = document.getElementById('shutdown-screen');
  if (shutdownOverlay) {
    if (doc.exists && doc.data().isShutdown === true) {
      shutdownOverlay.style.display = 'flex';
    } else {
      shutdownOverlay.style.display = 'none';
    }
  }
}, (error) => {
  console.error("Error monitoring shutdown status:", error);
});

// 2. Auth Listener: Manages UI button visibility based on your admin email
firebase.auth().onAuthStateChanged((user) => {
  const loginBtn = document.getElementById('login-btn');
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');
  const userAvatar = document.getElementById('user-avatar');
  
  const shutdownBtn = document.getElementById('shutdown-btn');
  const restoreBtn = document.getElementById('restore-btn');

  const isAdmin = user && user.email && user.email.toLowerCase() === 'skibidiw63@gmail.com';

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (userName) userName.innerText = user.displayName || user.email;
    if (userAvatar && user.photoURL) userAvatar.src = user.photoURL;

    // Admin Controls visibility
    if (shutdownBtn) shutdownBtn.style.display = isAdmin ? 'inline-block' : 'none';
    if (restoreBtn) restoreBtn.style.display = isAdmin ? 'inline-block' : 'none';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (userInfo) userInfo.style.display = 'none';
    if (shutdownBtn) shutdownBtn.style.display = 'none';
    if (restoreBtn) restoreBtn.style.display = 'none';
  }
});

// 3. Admin Function: Trigger Global Shutdown
function shutdownApp() {
  const user = firebase.auth().currentUser;
  if (user && user.email && user.email.toLowerCase() === 'skibidiw63@gmail.com') {
    db.collection('system').doc('status').set({ isShutdown: true })
      .then(() => console.log("System shut down globally."))
      .catch((err) => alert("Error executing shutdown: " + err.message));
  } else {
    alert("Unauthorized: Admin access required.");
  }
}

// 4. Admin Function: Restore App Globally
function restoreApp() {
  const user = firebase.auth().currentUser;
  if (user && user.email && user.email.toLowerCase() === 'skibidiw63@gmail.com') {
    db.collection('system').doc('status').set({ isShutdown: false })
      .then(() => console.log("System restored globally."))
      .catch((err) => alert("Error restoring system: " + err.message));
  } else {
    alert("Unauthorized: Admin access required.");
  }
}
