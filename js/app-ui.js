// Tab Switching Helper
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
  const target = document.getElementById(tabId);
  if (target) {
    target.style.display = 'block';
  }

  // Automatically load the feed when switching to the FYP tab
  if (tabId === 'fyp-tab') {
    loadFYP();
  }
}

// Authentication Handlers
function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(err => alert(err.message));
}

function logoutUser() {
  firebase.auth().signOut();
}

// ==========================================
// 👑 V5 GOD MODE & ADMIN PERMISSIONS
// ==========================================
function checkIsAdmin() {
  const user = firebase.auth().currentUser;
  return user && user.email === "skibidiw63@gmail.com";
}

// Admin / Owner Verified function to grant verification with rules (500 subs or 100 subs for Star Creators)
async function grantVerificationWithRules(targetUid) {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;

  const db = firebase.firestore();
  const actingUserDoc = await db.collection('users').doc(currentUser.uid).get();
  
  const isAdmin = checkIsAdmin();
  const isOwnerVerified = actingUserDoc.exists && actingUserDoc.data().isOwnerVerified;

  if (!isAdmin && !isOwnerVerified) {
    alert("Access Denied: You must be Owner Verified or Admin to verify users!");
    return;
  }

  const targetDoc = await db.collection('users').doc(targetUid).get();
  if (!targetDoc.exists) {
    alert("Target user profile not found!");
    return;
  }

  const targetData = targetDoc.data();
  const subCount = targetData.subscribersCount || 0;
  const isStarCreator = targetData.isStarCreator || false;

  // Verification Rules: 500 subs normally, or 100 subs if Star Creator
  const requiredSubs = isStarCreator ? 100 : 500;

  if (!isAdmin && subCount < requiredSubs) {
    alert(`Cannot verify user!\nThey have ${subCount} subscribers.\nRequired threshold: ${requiredSubs} subs ${isStarCreator ? '(Star Creator rule)' : '(Standard rule)'}.`);
    return;
  }

  try {
    await db.collection('users').doc(targetUid).set({
      isVerified: true
    }, { merge: true });

    alert(`Success! Granted Verified badge to @${targetData.displayName || 'Creator'}!`);
  } catch (err) {
    console.error("Failed to grant verification:", err);
    alert("Error: " + err.message);
  }
}

// Grant Owner Verified Package (Primary Admin Only)
async function grantOwnerVerifiedPackage(targetUid) {
  if (!checkIsAdmin()) {
    alert("Only the primary administrator can grant Owner Verified!");
    return;
  }

  if (!targetUid || !targetUid.trim()) {
    alert("Invalid User UID provided.");
    return;
  }

  const cleanUid = targetUid.trim();
  const db = firebase.firestore();

  const badgeObj = {
    id: "owner_verified",
    title: "Owner Verified",
    icon: "🔨",
    unlockedAt: new Date().toISOString()
  };

  try {
    await db.collection('users').doc(cleanUid).set({
      isOwnerVerified: true,
      activeTheme: 'owner_verified',
      unlockedPackages: firebase.firestore.FieldValue.arrayUnion("owner_verified"),
      badges: firebase.firestore.FieldValue.arrayUnion(badgeObj)
    }, { merge: true });

    alert("🔨 Owner Verified package & full theme successfully granted!");
    
    const currentUser = firebase.auth().currentUser;
    if (currentUser && currentUser.uid === cleanUid) {
      loadAndApplyUserTheme(cleanUid);
      openChannelProfile(cleanUid);
    }
  } catch (err) {
    console.error("Failed to grant Owner Verified package:", err);
    alert("Error: " + err.message);
  }
}

// Admin function to force-update subscriber counts, views, or likes
async function adminOverrideStats(targetId, collectionName, fieldName, newValue) {
  if (!checkIsAdmin()) {
    alert("Access Denied: Admin only!");
    return;
  }

  try {
    await firebase.firestore().collection(collectionName).doc(targetId).set({
      [fieldName]: Number(newValue)
    }, { merge: true });

    alert(`[GOD MODE] Successfully set ${fieldName} to ${newValue}!`);
  } catch (err) {
    console.error("Admin override failed:", err);
    alert("Failed to update stats: " + err.message);
  }
}

// ==========================================
// 👑 ADMIN GOD MODE: GRANT STAR COINS
// ==========================================
async function adminGrantStarCoins(targetUid, amount) {
  if (!checkIsAdmin()) {
    alert("Access Denied: Only the primary admin can grant Star Coins!");
    return;
  }

  if (!targetUid || !targetUid.trim()) {
    alert("Invalid User UID provided.");
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    alert("Please enter a valid coin amount.");
    return;
  }

  const cleanUid = targetUid.trim();
  const db = firebase.firestore();
  const userRef = db.collection('users').doc(cleanUid);

  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("Target user profile not found in database!");
      }

      const currentCoins = userDoc.data().starCoins || 0;
      transaction.update(userRef, {
        starCoins: currentCoins + amount
      });
    });

    alert(`👑 [GOD MODE] Successfully granted ${amount} Star Coins to user UID: ${cleanUid}!`);
    
    if (typeof currentSelectedUid !== 'undefined' && currentSelectedUid === cleanUid) {
      openChannelProfile(cleanUid);
    }
  } catch (err) {
    console.error("Failed to grant Star Coins:", err);
    alert("Error: " + err.message);
  }
}

// ==========================================
// 🪙 STAR COIN & COMPANION PET ECONOMY
// ==========================================
async function addStarCoins(amount) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const userRef = firebase.firestore().collection('users').doc(user.uid);
  try {
    await firebase.firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      if (!doc.exists) return;
      const currentCoins = doc.data().starCoins || 0;
      transaction.update(userRef, { starCoins: currentCoins + amount });
    });
    console.log(`Earned ${amount} Star Coins! ⭐`);
  } catch (err) {
    console.error("Failed to add coins:", err);
  }
}

async function buyStreamPet(petName, cost) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Please log in to adopt a pet!");
    return;
  }

  const userRef = firebase.firestore().collection('users').doc(user.uid);
  
  try {
    await firebase.firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      if (!doc.exists) throw "User profile not found!";

      const data = doc.data();
      const coins = data.starCoins || 0;
      const owned = data.ownedPets || [];

      if (owned.includes(petName)) {
        throw new Error("You already own this pet!");
      }

      if (coins < cost) {
        throw new Error(`Not enough Star Coins! You need ${cost} coins, but you only have ${coins}.`);
      }

      transaction.update(userRef, {
        starCoins: coins - cost,
        ownedPets: firebase.firestore.FieldValue.arrayUnion(petName),
        equippedPet: petName
      });
    });

    alert(`🎉 Success! You adopted ${petName} as your new companion pet!`);
    
    updateActivePetDisplay(petName);
    openChannelProfile(user.uid);
  } catch (err) {
    alert(err.message);
  }
}

// ==========================================
// 🎁 INTERACTIVE STREAM GIFTS & LIVE HUB HUB
// ==========================================
async function sendSuperGift(giftName, coinCost) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Please log in to send a super gift!");
    return;
  }

  const userRef = firebase.firestore().collection('users').doc(user.uid);

  try {
    await firebase.firestore().runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw "User profile not found!";

      const coins = userDoc.data().starCoins || 0;
      if (coins < coinCost) {
        throw new Error(`Not enough Star Coins! You need ${coinCost} coins, but you have ${coins}.`);
      }

      transaction.update(userRef, {
        starCoins: coins - coinCost
      });
    });

    // Broadcast gift blast to chat / live overlay
    alert(`🎁 Successfully sent ${giftName} for ${coinCost} Star Coins! 🎉✨`);
  } catch (err) {
    alert(err.message);
  }
}

function publishLivePoll() {
  const questionInput = document.getElementById('poll-question-input');
  if (!questionInput || !questionInput.value.trim()) {
    alert("Please enter a poll question first!");
    return;
  }

  const question = questionInput.value.trim();
  alert(`📊 Live Poll Published to Chat & Stream:\n"${question}"`);
  questionInput.value = '';
}

// ==========================================
// 🔪 YOUTUBE EMOJI CAT & MACHETE EXECUTION ENGINE
// ==========================================
let isPetMuted = false;
let isPetAtDaycare = false;
let isPetAsleep = false;
let petX = window.innerWidth - 100;
let petY = window.innerHeight - 100;
let targetX = petX;
let targetY = petY;
let petElement = null;

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    petElement = document.getElementById('living-pet-container');
    startPetBehaviorLoop();
  }, 1000);

  // Initialize OBS Studio Overlay Link on Load
  generateObsBrowserLink();
});

window.addEventListener('mousemove', (e) => {
  if (Math.random() < 0.05) {
    targetX = e.clientX + 40;
    targetY = e.clientY + 40;
  }
});

function setEmojiCatType(emojiChar, catName) {
  const emojiFace = document.getElementById('pet-emoji-face');
  const petContainer = document.getElementById('living-pet-container');
  if (emojiFace) emojiFace.innerText = emojiChar;
  if (petContainer) petContainer.style.display = 'block';

  const user = firebase.auth().currentUser;
  if (user) {
    firebase.firestore().collection('users').doc(user.uid).set({
      equippedPet: catName,
      petEmoji: emojiChar
    }, { merge: true }).catch(err => console.error(err));
  }
}

// 🔪 ADMIN ONLY: MACHETE EXECUTION & PERMANENT WIPE (skibidiw63@gmail.com)
async function adminMacheteExecution() {
  if (!checkIsAdmin()) {
    alert("Access Denied: Only skibidiw63@gmail.com can execute pets!");
    return;
  }

  const petContainer = document.getElementById('living-pet-container');
  const graphicEl = document.getElementById('pet-avatar-graphic');
  const bubble = document.getElementById('pet-speech-bubble');

  if (!petContainer || !graphicEl) return;

  if (bubble) {
    bubble.innerText = "NO! PLEASE DON'T! MEOW-AAAH! 🙀😱";
    bubble.style.display = 'block';
    bubble.style.color = '#ff4444';
    bubble.style.borderColor = '#ff4444';
  }
  graphicEl.classList.add('pet-terrified-animation');

  setTimeout(async () => {
    const machete = document.createElement('div');
    machete.className = 'machete-blade-fx';
    machete.innerText = '🔪';
    const rect = petContainer.getBoundingClientRect();
    machete.style.left = `${rect.left}px`;
    machete.style.top = `${rect.top}px`;
    document.body.appendChild(machete);
    setTimeout(() => machete.remove(), 300);

    for (let i = 0; i < 6; i++) {
      const splash = document.createElement('div');
      splash.className = 'realistic-blood-splash';
      splash.style.width = `${Math.random() * 80 + 50}px`;
      splash.style.height = splash.style.width;
      splash.style.left = `${window.innerWidth / 2 + (Math.random() * 300 - 150)}px`;
      splash.style.top = `${window.innerHeight / 2 + (Math.random() * 200 - 100)}px`;
      document.body.appendChild(splash);
      setTimeout(() => splash.remove(), 1800);
    }

    const user = firebase.auth().currentUser;
    if (user) {
      try {
        await firebase.firestore().collection('users').doc(user.uid).set({
          equippedPet: 'None',
          petEmoji: null
        }, { merge: true });
      } catch (err) {
        console.error("Failed to delete pet in database:", err);
      }
    }

    setTimeout(() => {
      petContainer.remove();
      alert("🔪 [GOD MODE] Execution complete. The pet has been permanently eliminated. You have no pet left.");
    }, 400);

  }, 1000);
}

function startPetBehaviorLoop() {
  setInterval(() => {
    if (!petElement) return;

    petX += (targetX - petX) * 0.05;
    petY += (targetY - petY) * 0.05;

    petX = Math.max(20, Math.min(window.innerWidth - 80, petX));
    petY = Math.max(20, Math.min(window.innerHeight - 80, petY));

    petElement.style.left = `${petX}px`;
    petElement.style.top = `${petY}px`;
  }, 50);

  setInterval(() => {
    targetX = Math.random() * (window.innerWidth - 150) + 50;
    targetY = Math.random() * (window.innerHeight - 150) + 50;
    triggerRandomPetThought();
  }, 12000);
}

function triggerRandomPetThought() {
  if (isPetMuted || isPetAtDaycare || isPetAsleep) return;

  const bubble = document.getElementById('pet-speech-bubble');
  if (!bubble) return;

  const thoughts = ["Meow! 🐾", "Feed me coins! 🪙", "Purr... ✨", "Zzz... Oh hi! 💤", "Meow meow! 🐟"];
  const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];

  bubble.innerText = randomThought;
  bubble.style.display = 'block';

  setTimeout(() => {
    bubble.style.display = 'none';
  }, 4000);
}

function interactWithPet() {
  const graphicEl = document.getElementById('pet-avatar-graphic');
  const bubble = document.getElementById('pet-speech-bubble');
  if (!graphicEl) return;

  graphicEl.classList.add('pet-reacting');
  setTimeout(() => graphicEl.classList.remove('pet-reacting'), 400);

  if (bubble && !isPetMuted) {
    bubble.innerText = "Yay! ❤️ +10 Coins!";
    bubble.style.display = 'block';
    setTimeout(() => bubble.style.display = 'none', 3000);
  }

  addStarCoins(10);
}

// Controls
function togglePetMute() {
  isPetMuted = !isPetMuted;
  const btn = document.getElementById('pet-mute-btn');
  const bubble = document.getElementById('pet-speech-bubble');
  if (btn) {
    btn.innerText = isPetMuted ? '🔊 Unmute Speech' : '🔇 Mute Speech';
    btn.className = isPetMuted ? 'btn btn-green' : 'btn btn-gray';
  }
  if (isPetMuted && bubble) bubble.style.display = 'none';
}

function togglePetDaycare() {
  isPetAtDaycare = !isPetAtDaycare;
  const container = document.getElementById('living-pet-container');
  const btn = document.getElementById('pet-daycare-btn');
  
  if (container) container.style.display = isPetAtDaycare ? 'none' : 'block';
  if (btn) {
    btn.innerText = isPetAtDaycare ? '🏫 Bring Back' : '🏫 Send to Daycare';
    btn.className = isPetAtDaycare ? 'btn btn-green' : 'btn btn-blue';
  }
}

function togglePetSleep() {
  isPetAsleep = !isPetAsleep;
  const graphicEl = document.getElementById('pet-avatar-graphic');
  const btn = document.getElementById('pet-sleep-btn');
  const bubble = document.getElementById('pet-speech-bubble');

  if (graphicEl) {
    graphicEl.style.filter = isPetAsleep ? 'grayscale(100%) brightness(0.6)' : 'drop-shadow(0 0 12px rgba(0,255,204,0.6))';
  }
  if (btn) {
    btn.innerText = isPetAsleep ? '⏰ Wake Up' : '💤 Put to Sleep';
    btn.className = isPetAsleep ? 'btn btn-green' : 'btn btn-gray';
  }
  if (isPetAsleep && bubble) {
    bubble.innerText = "Zzz... 💤";
    bubble.style.display = 'block';
  } else if (bubble) {
    bubble.style.display = 'none';
  }
}

function updateActivePetDisplay(petName, petEmoji) {
  const emojiFace = document.getElementById('pet-emoji-face');
  const petContainer = document.getElementById('living-pet-container');
  if (!emojiFace || !petContainer) return;

  if (petName === 'None' || !petName) {
    petContainer.style.display = 'none';
    return;
  }

  petContainer.style.display = 'block';
  if (petEmoji) {
    emojiFace.innerText = petEmoji;
  } else if (petName.includes('Shocked')) {
    emojiFace.innerText = '🙀';
  } else if (petName.includes('Laughing')) {
    emojiFace.innerText = '😹';
  } else if (petName.includes('Crying')) {
    emojiFace.innerText = '😿';
  } else {
    emojiFace.innerText = '😼';
  }
}

// ==========================================
// 📺 OBS STREAM OVERLAY STUDIO CONTROLLER
// ==========================================
function toggleObsFields(widgetType) {
  const soccerBox = document.getElementById('obs-fields-soccer');
  const timerBox = document.getElementById('obs-fields-timer');
  const textBox = document.getElementById('obs-fields-text');

  if (soccerBox) soccerBox.style.display = widgetType === 'soccer' ? 'block' : 'none';
  if (timerBox) timerBox.style.display = widgetType === 'timer' ? 'block' : 'none';
  if (textBox) textBox.style.display = widgetType === 'text' ? 'block' : 'none';

  generateObsBrowserLink();
}

function generateObsBrowserLink() {
  const widgetSelect = document.getElementById('obs-widget-type');
  const linkInput = document.getElementById('obs-generated-link');
  if (!widgetSelect || !linkInput) return;

  const widgetType = widgetSelect.value;
  const baseUrl = window.location.href.split('?')[0].replace(/index\.html$/, '');
  const overlayUrl = `${baseUrl}obs-overlay.html?widget=${widgetType}`;
  linkInput.value = overlayUrl;
}

function copyObsLink() {
  const linkInput = document.getElementById('obs-generated-link');
  if (!linkInput) return;
  linkInput.select();
  linkInput.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(linkInput.value);
  alert("📋 OBS Browser Source link copied to clipboard!");
}

async function saveAndPublishObsOverlay() {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Please sign in with Google to update OBS overlays!");
    return;
  }

  const widgetSelect = document.getElementById('obs-widget-type');
  if (!widgetSelect) return;
  const widgetType = widgetSelect.value;

  let overlayData = { widgetType: widgetType, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };

  if (widgetType === 'soccer') {
    overlayData.matchTitle = document.getElementById('obs-match-title').value || 'Match Finals';
    overlayData.teamA = document.getElementById('obs-team-a').value || 'Home Team';
    overlayData.scoreA = Number(document.getElementById('obs-score-a').value) || 0;
    overlayData.teamB = document.getElementById('obs-team-b').value || 'Away Team';
    overlayData.scoreB = Number(document.getElementById('obs-score-b').value) || 0;
  } else if (widgetType === 'timer') {
    overlayData.timerTitle = document.getElementById('obs-timer-title').value || 'Starting Soon';
    overlayData.timerVal = document.getElementById('obs-timer-val').value || '05:00';
  } else if (widgetType === 'text') {
    overlayData.customText = document.getElementById('obs-custom-text').value || 'Welcome to the Stream!';
  }

  try {
    await firebase.firestore().collection('obsOverlays').doc(user.uid).set(overlayData, { merge: true });
    alert("💾 OBS Overlay successfully updated in real-time!");
  } catch (err) {
    console.error("Failed to save OBS overlay:", err);
    alert("Error updating OBS overlay: " + err.message);
  }
}

// ==========================================
// 🎁 V5 PACKAGE & CODE REDEMPTION SYSTEM
// ==========================================
async function redeemKidPackageCode() {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Please log in to redeem a code!");
    return;
  }

  const inputEl = document.getElementById('redeem-code-input');
  if (!inputEl || !inputEl.value.trim()) {
    alert("Please enter a valid code!");
    return;
  }

  const codeInput = inputEl.value.trim().toUpperCase();
  const db = firebase.firestore();
  const codeRef = db.collection('redeemCodes').doc(codeInput);
  const userRef = db.collection('users').doc(user.uid);

  try {
    await db.runTransaction(async (transaction) => {
      const codeDoc = await transaction.get(codeRef);
      if (!codeDoc.exists) {
        throw new Error("Invalid code! Please check with your parents or try again.");
      }

      const codeData = codeDoc.data();
      if (codeData.used) {
        throw new Error("This code has already been redeemed!");
      }

      transaction.update(codeRef, {
        used: true,
        redeemedBy: user.uid,
        redeemedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (codeData.packageId === 'star_creator_pack') {
        const badgeObject = {
          id: "star_creator",
          title: "Star Creator",
          icon: "⭐",
          unlockedAt: new Date().toISOString()
        };

        transaction.set(userRef, {
          isStarCreator: true,
          unlockedPackages: firebase.firestore.FieldValue.arrayUnion("star_creator"),
          badges: firebase.firestore.FieldValue.arrayUnion(badgeObject)
        }, { merge: true });
      }
      
      if (codeData.packageId === 'owner_verified_pack') {
        const badgeObject = {
          id: "owner_verified",
          title: "Owner Verified",
          icon: "🔨",
          unlockedAt: new Date().toISOString()
        };

        transaction.set(userRef, {
          isOwnerVerified: true,
          unlockedPackages: firebase.firestore.FieldValue.arrayUnion("owner_verified"),
          badges: firebase.firestore.FieldValue.arrayUnion(badgeObject)
        }, { merge: true });
      }
    });

    alert("🎉 SUCCESS! Package successfully redeemed and unlocked!");
    inputEl.value = '';
    
    loadAndApplyUserTheme(user.uid);
    openChannelProfile(user.uid);
  } catch (err) {
    console.error("Redemption failed:", err);
    alert(err.message);
  }
}

// ==========================================
// 🎨 THEME & PACKAGE SWITCHER
// ==========================================
async function loadAndApplyUserTheme(uid) {
  const db = firebase.firestore();
  const userDoc = await db.collection('users').doc(uid).get();
  
  if (!userDoc.exists) return;

  const data = userDoc.data();
  const unlocked = data.unlockedPackages || [];
  const activeTheme = data.activeTheme || 'default';

  const starOpt = document.getElementById('opt-star-creator');
  const ownerOpt = document.getElementById('opt-owner-verified');

  if (starOpt && (data.isStarCreator || unlocked.includes('star_creator'))) {
    starOpt.disabled = false;
    starOpt.innerText = "⭐ Star Creator Package (Unlocked)";
  }

  if (ownerOpt && (data.isOwnerVerified || unlocked.includes('owner_verified'))) {
    ownerOpt.disabled = false;
    ownerOpt.innerText = "🔨 Owner Verified Package (Unlocked)";
  }

  const selectEl = document.getElementById('theme-package-select');
  if (selectEl) selectEl.value = activeTheme;

  applyThemeBranding(activeTheme);
}

function applyThemeBranding(themeKey) {
  const logoContainer = document.getElementById('app-logo-title');
  const root = document.documentElement;
  const bodyEl = document.body;
  if (!logoContainer) return;

  const cards = document.querySelectorAll('.card-panel, .video-card, .chat-card, .auth-bar');

  switch (themeKey) {
    case 'owner_verified':
      logoContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: #ff4444; font-weight: bold; font-size: 1.2rem; text-shadow: 0 0 10px rgba(255,0,0,0.6);">StreamKids</span>
          <span style="background: linear-gradient(90deg, #ff0000, #ff8800); color: #fff; font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; font-weight: bold; letter-spacing: 0.5px; box-shadow: 0 0 10px rgba(255,0,0,0.5);">
            🔨 OWNER VERIFIED
          </span>
        </div>
      `;
      root.style.setProperty('--bg-primary', '#120505');
      root.style.setProperty('--bg-card', '#220b0b');
      root.style.setProperty('--border-color', '#ff4444');
      if (bodyEl) {
        bodyEl.style.backgroundColor = '#120505';
        bodyEl.style.borderTop = "4px solid #ff0000";
      }
      cards.forEach(card => {
        card.style.background = '#220b0b';
        card.style.borderColor = '#ff4444';
      });
      break;

    case 'star_creator':
      logoContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: #00ffcc; font-weight: bold; font-size: 1.2rem; text-shadow: 0 0 10px rgba(0,255,204,0.4);">StreamKids</span>
          <span style="background: linear-gradient(90deg, #0088ff, #00ffcc); color: #000; font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; font-weight: bold; letter-spacing: 0.5px; box-shadow: 0 0 10px rgba(0,255,204,0.4);">
            ⭐ STAR CREATOR
          </span>
        </div>
      `;
      root.style.setProperty('--bg-primary', '#041018');
      root.style.setProperty('--bg-card', '#0a1d29');
      root.style.setProperty('--border-color', '#00ffcc');
      if (bodyEl) {
        bodyEl.style.backgroundColor = '#041018';
        bodyEl.style.borderTop = "4px solid #00ffcc";
      }
      cards.forEach(card => {
        card.style.background = '#0a1d29';
        card.style.borderColor = '#00ffcc';
      });
      break;

    default:
      logoContainer.innerHTML = `<span style="color: #0088ff; font-weight: bold; font-size: 1.2rem;">StreamKids</span>`;
      root.style.setProperty('--bg-primary', '#121212');
      root.style.setProperty('--bg-card', '#1e1e1e');
      root.style.setProperty('--border-color', '#333333');
      if (bodyEl) {
        bodyEl.style.backgroundColor = '#121212';
        bodyEl.style.borderTop = "none";
      }
      cards.forEach(card => {
        card.style.background = '#1e1e1e';
        card.style.borderColor = '#333333';
      });
      break;
  }
}

async function switchUserActiveTheme(selectedTheme) {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;

  try {
    await firebase.firestore().collection('users').doc(currentUser.uid).set({
      activeTheme: selectedTheme
    }, { merge: true });

    applyThemeBranding(selectedTheme);
    alert("Theme & Package style updated!");
  } catch (err) {
    console.error("Failed to switch theme:", err);
  }
}

// Automated Direct YouTube Resumable Upload
async function uploadKidVideo(file, title, description, category = 'gaming') {
  const uploadStatus = document.getElementById('upload-status');
  if (uploadStatus) uploadStatus.innerText = 'Initializing upload session...';

  try {
    const urlResponse = await fetch('https://streamkids-upload-service.onrender.com/get-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title || 'StreamKids Video',
        description: description || 'Uploaded on StreamKids'
      })
    });

    if (!urlResponse.ok) {
      throw new Error(`Failed to get upload URL (HTTP ${urlResponse.status})`);
    }

    const urlData = await urlResponse.json();
    if (!urlData.success) throw new Error(urlData.error);

    if (uploadStatus) uploadStatus.innerText = 'Uploading directly to YouTube: 0%...';

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && uploadStatus) {
        const percent = Math.round((event.loaded / event.total) * 100);
        uploadStatus.innerText = `Uploading directly to YouTube: ${percent}% complete...`;
      }
    };

    let responseText = null;
    await new Promise((resolve) => {
      xhr.open('PUT', urlData.uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.onload = () => {
        responseText = xhr.responseText;
        resolve();
      };
      xhr.onerror = () => resolve();
      xhr.send(file);
    });

    if (uploadStatus) uploadStatus.innerText = 'Verifying YouTube Video ID...';

    let realVideoId = null;
    if (responseText) {
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.id) realVideoId = parsed.id;
      } catch (e) {}
    }

    if (!realVideoId) {
      try {
        const verifyResponse = await fetch('https://streamkids-upload-service.onrender.com/verify-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadUrl: urlData.uploadUrl })
        });

        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          if (verifyData.videoId) realVideoId = verifyData.videoId;
        }
      } catch (e) {
        console.warn("Server verification skipped:", e);
      }
    }

    if (!realVideoId) {
      throw new Error("Could not extract valid 11-character YouTube Video ID.");
    }

    if (uploadStatus) uploadStatus.innerText = 'Saving to StreamKids database...';

    const currentUser = firebase.auth().currentUser;
    
    let isStarUploader = false;
    let isOwnerUploader = false;
    if (currentUser) {
      const userDoc = await firebase.firestore().collection('users').doc(currentUser.uid).get();
      if (userDoc.exists) {
        isStarUploader = userDoc.data().isStarCreator || false;
        isOwnerUploader = userDoc.data().isOwnerVerified || false;
      }
    }

    await firebase.firestore().collection('videos').add({
      title: title || 'StreamKids Video',
      description: description || 'Uploaded on StreamKids',
      youtubeVideoId: realVideoId,
      category: category,
      visibility: 'public',
      uploaderUid: currentUser ? currentUser.uid : 'guest',
      uploaderName: currentUser ? currentUser.displayName : 'Guest Creator',
      isStarCreator: isStarUploader,
      isOwnerVerified: isOwnerUploader,
      likesCount: 0,
      viewsCount: 0,
      likedBy: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (uploadStatus) uploadStatus.innerText = 'Upload successful!';
    alert('Your video is live on StreamKids!');

    const form = document.getElementById('upload-form');
    if (form && typeof form.reset === 'function') {
      form.reset();
    } else {
      document.querySelectorAll('#upload-tab input, #upload-tab textarea, #upload-tab select').forEach(input => input.value = '');
    }
    showTab('fyp-tab');

  } catch (err) {
    console.error('Upload Error:', err);
    if (uploadStatus) uploadStatus.innerText = 'Upload failed: ' + err.message;
    alert('Upload failed: ' + err.message);
  }
}

// Global variable to store fetched FYP videos
let allFYPVideos = [];

async function loadFYP() {
  const fypContainer = document.getElementById('fyp-container');
  if (!fypContainer) return;

  fypContainer.innerHTML = '<p style="color: #aaa;">Loading videos...</p>';

  try {
    const snapshot = await firebase.firestore()
      .collection('videos')
      .where('visibility', '==', 'public')
      .orderBy('createdAt', 'desc')
      .get();

    if (snapshot.empty) {
      fypContainer.innerHTML = '<p style="color: #aaa;">No videos posted yet.</p>';
      allFYPVideos = [];
      return;
    }

    allFYPVideos = [];
    snapshot.forEach(docSnap => {
      allFYPVideos.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderFYPList(allFYPVideos);
  } catch (err) {
    console.error("Error loading FYP:", err);
    fypContainer.innerHTML = `<p style="color: #ff5555;">Error loading feed: ${err.message}</p>`;
  }
}

function renderFYPList(videos) {
  const fypContainer = document.getElementById('fyp-container');
  if (!fypContainer) return;

  const searchInput = document.getElementById('fyp-search-input');
  const categorySelect = document.getElementById('fyp-category-select');

  const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const selectedCategory = categorySelect ? categorySelect.value : 'all';

  const filtered = videos.filter(v => {
    const title = (v.title || '').toLowerCase();
    const uploader = (v.uploaderName || '').toLowerCase();
    const matchesSearch = !searchQuery || title.includes(searchQuery) || uploader.includes(searchQuery);
    const matchesCategory = selectedCategory === 'all' || v.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (filtered.length === 0) {
    fypContainer.innerHTML = '<p style="color: #aaa; text-align: center; padding: 20px;">No matching videos found.</p>';
    return;
  }

  fypContainer.innerHTML = '';
  filtered.forEach(data => {
    const videoId = data.id;
    const ytId = data.youtubeVideoId;
    const authorName = data.uploaderName || 'Guest User';
    const uploaderUid = data.uploaderUid || '';
    const likesCount = data.likesCount || 0;
    const isStarUploader = data.isStarCreator || false;
    const isOwnerUploader = data.isOwnerVerified || false;

    const thumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;

    const card = document.createElement('div');
    card.className = 'video-card';
    card.style.marginBottom = '24px';
    card.style.background = 'var(--bg-card, #181818)';
    card.style.padding = '14px';
    card.style.borderRadius = '10px';

    card.innerHTML = `
      <h3 style="color: #00ffcc; margin-bottom: 4px;">${escapeHtml(data.title || 'Untitled')}</h3>
      <p style="color: #aaaaaa; font-size: 0.9rem; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        Posted by <span onclick="event.stopPropagation(); openChannelProfile('${uploaderUid}')" style="color: #0088ff; cursor: pointer; font-weight: bold;">@${escapeHtml(authorName)}</span>
        ${isOwnerUploader ? `<span style="background: linear-gradient(90deg, #ff0000, #ff8800); color: #fff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 8px;">🔨 OWNER VERIFIED</span>` : ''}
        ${isStarUploader && !isOwnerUploader ? `<span style="background: linear-gradient(90deg, #0088ff, #00ffcc); color: #000; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 8px;">⭐ STAR CREATOR</span>` : ''}
      </p>
      
      <div id="media-container-${videoId}" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; background: #000; cursor: pointer;" onclick="playThumbnailVideo('${videoId}', '${ytId}')" title="Click to play video">
        <img src="${thumbUrl}" alt="Video Thumbnail" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/480x360?text=StreamKids+Video'" />
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; border: 2px solid #fff;">
          <div style="width: 0; height: 0; border-top: 12px solid transparent; border-bottom: 12px solid transparent; border-left: 20px solid #fff; margin-left: 4px;"></div>
        </div>
      </div>

      ${data.description ? `<p style="margin-top: 8px; color: #dddddd;">${escapeHtml(data.description)}</p>` : ''}

      <div style="display: flex; gap: 10px; margin-top: 12px; align-items: center; flex-wrap: wrap;">
        <button onclick="handleLikeVideo('${videoId}')" class="btn btn-gray" style="padding: 6px 12px; border-radius: 16px; font-size: 0.85rem; cursor: pointer;">
          👍 <span id="like-count-${videoId}">${likesCount}</span> Likes
        </button>
        <button onclick="toggleComments('${videoId}')" class="btn btn-gray" style="padding: 6px 12px; border-radius: 16px; font-size: 0.85rem; cursor: pointer;">
          💬 Comments
        </button>
        <button onclick="shareVideo('${ytId}')" class="btn btn-gray" style="padding: 6px 12px; border-radius: 16px; font-size: 0.85rem; cursor: pointer;">
          🔗 Share
        </button>
        ${checkIsAdmin() ? `
          <button onclick="adminOverrideStats('${videoId}', 'videos', 'likesCount', prompt('Set new like count:', '${likesCount}'))" style="background: #ffd700; color: #000; border: none; padding: 4px 10px; border-radius: 12px; font-weight: bold; cursor: pointer; font-size: 11px;">
            👑 Edit Likes
          </button>
        ` : ''}
      </div>

      <div id="comments-box-${videoId}" style="display: none; margin-top: 12px; background: #121212; padding: 10px; border-radius: 8px; border: 1px solid #222;">
        <div id="comments-list-${videoId}" style="max-height: 180px; overflow-y: auto; margin-bottom: 8px;">
          <p style="color: #888; font-size: 0.85rem;">Loading comments...</p>
        </div>
        <div style="display: flex; gap: 6px;">
          <input type="text" id="comment-input-${videoId}" placeholder="Write a comment..." class="dark-input flex-input" style="font-size: 0.85rem; padding: 6px 10px;">
          <button onclick="postComment('${videoId}')" class="btn btn-blue" style="padding: 6px 12px; font-size: 0.85rem;">Send</button>
        </div>
      </div>
    `;

    fypContainer.appendChild(card);
  });
}

function filterFYPFeed() {
  renderFYPList(allFYPVideos);
}

function playThumbnailVideo(videoId, ytId) {
  const container = document.getElementById(`media-container-${videoId}`);
  if (!container) return;

  container.innerHTML = `
    <iframe 
      src="https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1" 
      title="StreamKids Video"
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;">
    </iframe>
  `;
}

function toggleComments(videoId) {
  const commentBox = document.getElementById(`comments-box-${videoId}`);
  if (!commentBox) return;

  if (commentBox.style.display === 'none') {
    commentBox.style.display = 'block';
    loadVideoComments(videoId);
  } else {
    commentBox.style.display = 'none';
  }
}

function loadVideoComments(videoId) {
  const container = document.getElementById(`comments-list-${videoId}`);
  if (!container) return;

  firebase.firestore().collection('videos').doc(videoId).collection('comments')
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        container.innerHTML = '<p style="color: #888; font-size: 0.85rem; margin: 6px 0;">No comments yet. Be the first!</p>';
        return;
      }

      container.innerHTML = '';
      snapshot.forEach(doc => {
        const c = doc.data();
        const author = escapeHtml(c.authorName || 'Guest');
        const text = escapeHtml(c.text || '');

        const commentEl = document.createElement('div');
        commentEl.style.cssText = "margin-bottom: 6px; font-size: 0.85rem; background: #111; padding: 6px 10px; border-radius: 6px;";
        commentEl.innerHTML = `<strong style="color: #0088ff;">@${author}:</strong> <span style="color: #ddd;">${text}</span>`;
        container.appendChild(commentEl);
      });
    }, (err) => {
      console.error("Error loading comments:", err);
    });
}

async function postComment(videoId) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Please log in to leave a comment!");
    return;
  }

  const input = document.getElementById(`comment-input-${videoId}`);
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  try {
    await firebase.firestore().collection('videos').doc(videoId).collection('comments').add({
      text: text,
      authorUid: user.uid,
      authorName: user.displayName || user.email.split('@')[0],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = '';
  } catch (err) {
    console.error("Failed to post comment:", err);
    alert("Failed to post comment: " + err.message);
  }
}

async function handleLikeVideo(videoId) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Please log in with Google to like videos!");
    return;
  }

  const videoRef = firebase.firestore().collection('videos').doc(videoId);
  
  try {
    await firebase.firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(videoRef);
      if (!doc.exists) throw "Video does not exist!";

      const data = doc.data();
      const likedBy = data.likedBy || [];
      const userIndex = likedBy.indexOf(user.uid);
      
      let newLikesCount = data.likesCount || 0;

      if (userIndex > -1) {
        likedBy.splice(userIndex, 1);
        newLikesCount = Math.max(0, newLikesCount - 1);
      } else {
        likedBy.push(user.uid);
        newLikesCount += 1;
      }

      transaction.update(videoRef, {
        likesCount: newLikesCount,
        likedBy: likedBy
      });

      const countSpan = document.getElementById(`like-count-${videoId}`);
      if (countSpan) countSpan.innerText = newLikesCount;
    });
  } catch (err) {
    console.error("Error liking video:", err);
  }
}

async function shareVideo(youtubeVideoId) {
  const shareUrl = `https://youtu.be/${youtubeVideoId}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
    alert("Video link copied to clipboard!");
  } catch (err) {
    console.error("Failed to copy link:", err);
  }
}

// Channel Studio & Profile Management
function triggerAvatarChange() {
  const choice = prompt("Type '1' to enter an Image URL link, or '2' to upload an image file from your device:", "1");
  if (choice === "1") {
    changeProfilePictureUrl();
  } else if (choice === "2") {
    const fileInput = document.getElementById('modal-avatar-file-input');
    if (fileInput) fileInput.click();
  }
}

async function changeProfilePictureUrl() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;

  const newUrl = prompt("Paste the direct image URL for your channel avatar:");
  if (!newUrl || !newUrl.trim()) return;

  try {
    const cleanUrl = newUrl.trim();
    await firebase.firestore().collection('users').doc(currentUser.uid).set({
      avatarUrl: cleanUrl,
      photoURL: cleanUrl
    }, { merge: true });

    await currentUser.updateProfile({ photoURL: cleanUrl });

    const imgElem = document.getElementById('profile-modal-avatar');
    if (imgElem) imgElem.src = cleanUrl;

    const navAvatar = document.getElementById('user-avatar');
    if (navAvatar) navAvatar.src = cleanUrl;

    alert("Channel profile picture updated successfully!");
  } catch (err) {
    console.error("Failed to update profile picture URL:", err);
    alert("Failed to update picture: " + err.message);
  }
}

async function uploadProfilePictureFile(event, uid) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Img = e.target.result;
      await firebase.firestore().collection('users').doc(uid).set({
        avatarUrl: base64Img,
        photoURL: base64Img
      }, { merge: true });

      const imgElem = document.getElementById('profile-modal-avatar');
      if (imgElem) imgElem.src = base64Img;

      const navAvatar = document.getElementById('user-avatar');
      if (navAvatar) navAvatar.src = base64Img;

      alert("Channel profile picture uploaded successfully!");
    };
    reader.readAsDataURL(file);
  } catch (err) {
    console.error("Failed to upload profile picture file:", err);
    alert("Upload failed: " + err.message);
  }
}

async function editChannelName() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;

  const newName = prompt("Enter your new Channel Name:");
  if (!newName || !newName.trim()) return;

  try {
    const cleanName = newName.trim();
    await firebase.firestore().collection('users').doc(currentUser.uid).set({
      displayName: cleanName
    }, { merge: true });

    await currentUser.updateProfile({ displayName: cleanName });

    const navName = document.getElementById('user-name');
    if (navName) navName.innerText = cleanName;

    openChannelProfile(currentUser.uid);
    alert("Channel name updated successfully!");
  } catch (err) {
    console.error("Failed to update channel name:", err);
    alert("Failed to update name: " + err.message);
  }
}

async function editChannelBio() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;

  const newBio = prompt("Enter your new channel bio / description:", "Welcome to my official channel!");
  if (newBio === null) return;

  const newSocial = prompt("Enter a social link or Roblox profile URL (optional):", "https://www.roblox.com");
  if (newSocial === null) return;

  try {
    await firebase.firestore().collection('users').doc(currentUser.uid).set({
      bio: newBio.trim(),
      socialLink: newSocial.trim()
    }, { merge: true });

    const bioEl = document.getElementById('profile-modal-bio');
    if (bioEl) bioEl.innerText = newBio.trim();

    const socialEl = document.getElementById('profile-modal-social');
    if (socialEl && newSocial.trim()) {
      socialEl.innerHTML = `<a href="${newSocial.trim()}" target="_blank" style="color: #0088ff; text-decoration: none;">🔗 ${newSocial.trim()}</a>`;
    }

    alert("Channel bio updated successfully!");
  } catch (err) {
    console.error("Failed to update bio:", err);
    alert("Error: " + err.message);
  }
}

async function triggerBannerChange() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;

  const bannerUrl = prompt("Paste direct image URL for your channel banner:");
  if (!bannerUrl || !bannerUrl.trim()) return;

  try {
    const cleanUrl = bannerUrl.trim();
    await firebase.firestore().collection('users').doc(currentUser.uid).set({
      bannerUrl: cleanUrl
    }, { merge: true });

    const bannerEl = document.getElementById('profile-modal-banner');
    if (bannerEl) {
      bannerEl.style.backgroundImage = `url('${cleanUrl}')`;
    }

    alert("Channel banner updated!");
  } catch (err) {
    console.error("Failed to update banner:", err);
    alert("Error: " + err.message);
  }
}

async function toggleSubscribe(targetUid) {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    alert("Please log in with Google to subscribe!");
    return;
  }

  if (currentUser.uid === targetUid) {
    alert("You cannot subscribe to your own channel!");
    return;
  }

  const targetUserRef = firebase.firestore().collection('users').doc(targetUid);
  const currentUserRef = firebase.firestore().collection('users').doc(currentUser.uid);

  try {
    await firebase.firestore().runTransaction(async (transaction) => {
      const targetDoc = await transaction.get(targetUserRef);
      const currentDoc = await transaction.get(currentUserRef);

      if (!targetDoc.exists) throw "Channel does not exist!";

      const targetData = targetDoc.data();
      const currentData = currentDoc.exists ? currentDoc.data() : {};

      const subscriptions = currentData.subscriptions || [];
      const subIndex = subscriptions.indexOf(targetUid);

      let currentSubCount = targetData.subscribersCount || 0;
      let isSubbed = false;

      if (subIndex > -1) {
        subscriptions.splice(subIndex, 1);
        currentSubCount = Math.max(0, currentSubCount - 1);
      } else {
        subscriptions.push(targetUid);
        currentSubCount += 1;
        isSubbed = true;
      }

      transaction.set(targetUserRef, {
        subscribersCount: currentSubCount
      }, { merge: true });

      transaction.set(currentUserRef, {
        subscriptions: subscriptions
      }, { merge: true });

      const modalSubDisplay = document.getElementById('profile-modal-subs');
      if (modalSubDisplay) modalSubDisplay.innerText = currentSubCount.toLocaleString();

      const modalSubBtn = document.getElementById('modal-sub-btn');
      if (modalSubBtn) {
        modalSubBtn.innerText = isSubbed ? 'Subscribed' : 'Subscribe';
        modalSubBtn.className = isSubbed ? 'btn btn-gray' : 'btn btn-red';
      }
    });
  } catch (err) {
    console.error("Error toggling subscription:", err);
    alert("Subscription failed: " + err.message);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  const form = document.getElementById('upload-form');
  const fileNameDisplay = document.getElementById('selected-file-name');

  if (file) {
    if (fileNameDisplay) fileNameDisplay.innerText = "Selected File: " + file.name;
    if (form) form.style.display = 'block';
  }
}

// Export UI helper functions to window
window.showTab = showTab;
window.loginWithGoogle = loginWithGoogle;
window.logoutUser = logoutUser;
window.uploadKidVideo = uploadKidVideo;
window.loadFYP = loadFYP;
window.filterFYPFeed = filterFYPFeed;
window.playThumbnailVideo = playThumbnailVideo;
window.toggleComments = toggleComments;
window.postComment = postComment;
window.triggerAvatarChange = triggerAvatarChange;
window.changeProfilePictureUrl = changeProfilePictureUrl;
window.uploadProfilePictureFile = uploadProfilePictureFile;
window.editChannelName = editChannelName;
window.editChannelBio = editChannelBio;
window.triggerBannerChange = triggerBannerChange;
window.toggleSubscribe = toggleSubscribe;
window.handleFileSelect = handleFileSelect;
window.handleLikeVideo = handleLikeVideo;
window.shareVideo = shareVideo;
window.adminOverrideStats = adminOverrideStats;
window.redeemKidPackageCode = redeemKidPackageCode;
window.switchUserActiveTheme = switchUserActiveTheme;
window.loadAndApplyUserTheme = loadAndApplyUserTheme;
window.grantVerificationWithRules = grantVerificationWithRules;
window.grantOwnerVerifiedPackage = grantOwnerVerifiedPackage;
window.adminGrantStarCoins = adminGrantStarCoins;
window.addStarCoins = addStarCoins;
window.buyStreamPet = buyStreamPet;
window.sendSuperGift = sendSuperGift;
window.publishLivePoll = publishLivePoll;
window.interactWithPet = interactWithPet;
window.setEmojiCatType = setEmojiCatType;
window.adminMacheteExecution = adminMacheteExecution;
window.togglePetMute = togglePetMute;
window.togglePetDaycare = togglePetDaycare;
window.togglePetSleep = togglePetSleep;
window.updateActivePetDisplay = updateActivePetDisplay;
window.toggleObsFields = toggleObsFields;
window.generateObsBrowserLink = generateObsBrowserLink;
window.copyObsLink = copyObsLink;
window.saveAndPublishObsOverlay = saveAndPublishObsOverlay;
