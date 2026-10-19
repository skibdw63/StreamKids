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
// 👑 V4.9.9 GOD MODE ADMIN HELPER
// ==========================================
function checkIsAdmin() {
  const user = firebase.auth().currentUser;
  return user && user.email === "skibidiw63@gmail.com";
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

// Automated Direct YouTube Resumable Upload
async function uploadKidVideo(file, title, description) {
  const uploadStatus = document.getElementById('upload-status');
  if (uploadStatus) uploadStatus.innerText = 'Initializing upload session...';

  try {
    // 1. Get Direct YouTube Upload URL from Render
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

    // 2. Stream video file directly to YouTube's server
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

    // Try parsing raw response if browser captured it
    if (responseText) {
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.id) realVideoId = parsed.id;
      } catch (e) {}
    }

    // Try server verification if endpoint exists
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

    // 3. Save Video ID & Engagement Stats to Firestore
    await firebase.firestore().collection('videos').add({
      title: title || 'StreamKids Video',
      description: description || 'Uploaded on StreamKids',
      youtubeVideoId: realVideoId,
      visibility: 'public',
      uploaderUid: currentUser ? currentUser.uid : 'guest',
      uploaderName: currentUser ? currentUser.displayName : 'Guest Creator',
      likesCount: 0,
      viewsCount: 0,
      likedBy: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (uploadStatus) uploadStatus.innerText = 'Upload successful!';
    alert('Your video is live on StreamKids!');

    // Reset upload form cleanly
    const form = document.getElementById('upload-form');
    if (form && typeof form.reset === 'function') {
      form.reset();
    } else {
      document.querySelectorAll('#upload-tab input, #upload-tab textarea').forEach(input => input.value = '');
    }
    showTab('fyp-tab');

  } catch (err) {
    console.error('Upload Error:', err);
    if (uploadStatus) uploadStatus.innerText = 'Upload failed: ' + err.message;
    alert('Upload failed: ' + err.message);
  }
}

// Loads and renders videos in the For You Page (FYP) feed with Likes, Comments & Share
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
      return;
    }

    fypContainer.innerHTML = ''; // Clear loading text

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const videoId = docSnap.id;

      const authorName = data.uploaderName || data.userName || 'Guest User';
      const uploaderUid = data.uploaderUid || data.userId || data.uid || data.authorId || '';
      const likesCount = data.likesCount || 0;

      const card = document.createElement('div');
      card.className = 'video-card';
      card.style.marginBottom = '24px';
      card.style.background = '#181818';
      card.style.padding = '14px';
      card.style.borderRadius = '10px';

      card.innerHTML = `
        <h3 style="color: #00ffcc; margin-bottom: 4px;">${escapeHtml(data.title || 'Untitled')}</h3>
        <p style="color: #aaaaaa; font-size: 0.9rem; margin-bottom: 10px;">
          Posted by <span onclick="event.stopPropagation(); openChannelProfile('${uploaderUid}')" style="color: #0088ff; cursor: pointer; font-weight: bold;">@${escapeHtml(authorName)}</span>
        </p>
        
        <!-- Embedded YouTube Player -->
        <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; background: #000;">
          <iframe 
            src="https://www.youtube-nocookie.com/embed/${data.youtubeVideoId}?autoplay=0&rel=0&modestbranding=1" 
            title="${escapeHtml(data.title || 'StreamKids Video')}"
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;">
          </iframe>
        </div>

        ${data.description ? `<p style="margin-top: 8px; color: #dddddd;">${escapeHtml(data.description)}</p>` : ''}

        <!-- Engagement Bar (Likes & Share) -->
        <div style="display: flex; gap: 14px; margin-top: 12px; align-items: center;">
          <button onclick="handleLikeVideo('${videoId}')" style="background: #222; color: #fff; border: 1px solid #444; padding: 6px 14px; border-radius: 16px; cursor: pointer;">
            👍 <span id="like-count-${videoId}">${likesCount}</span> Likes
          </button>
          <button onclick="shareVideo('${data.youtubeVideoId}')" style="background: #222; color: #fff; border: 1px solid #444; padding: 6px 14px; border-radius: 16px; cursor: pointer;">
            🔗 Share
          </button>
          ${checkIsAdmin() ? `
            <button onclick="adminOverrideStats('${videoId}', 'videos', 'likesCount', prompt('Set new like count:', '${likesCount}'))" style="background: #ffd700; color: #000; border: none; padding: 4px 10px; border-radius: 12px; font-weight: bold; cursor: pointer; font-size: 11px;">
              👑 Edit Likes
            </button>
          ` : ''}
        </div>
      `;

      fypContainer.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading FYP:", err);
    fypContainer.innerHTML = `<p style="color: #ff5555;">Error loading feed: ${err.message}</p>`;
  }
}

// ==========================================
// 💖 V4.9.9 LIKES & SHARE HANDLERS
// ==========================================
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
        // Unlike
        likedBy.splice(userIndex, 1);
        newLikesCount = Math.max(0, newLikesCount - 1);
      } else {
        // Like
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

// Channel Profile View (Owner vs Viewer Controls)
async function openChannelProfile(targetUid) {
  const profileContainer = document.getElementById('profile-container');
  if (!profileContainer) return;

  if (!targetUid || targetUid === 'undefined') {
    profileContainer.innerHTML = `
      <div style="padding: 20px; color: #ff5555; text-align: center;">
        <h3>Channel Not Found</h3>
        <p style="color: #aaa;">This video was uploaded without a valid user ID attached.</p>
      </div>`;
    showTab('profile-tab');
    return;
  }

  const currentUser = firebase.auth().currentUser;
  const isOwner = currentUser && currentUser.uid === targetUid;
  const isAdminUser = checkIsAdmin();

  showTab('profile-tab');
  profileContainer.innerHTML = '<p style="color: #aaa;">Loading channel...</p>';

  try {
    const userDoc = await firebase.firestore().collection('users').doc(targetUid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const displayName = userData.displayName || 'StreamKids Creator';
    const handle = userData.handle || `@user_${targetUid.substring(0, 5)}`;
    const subscribersCount = userData.subscribersCount || 0;
    
    let avatarUrl = userData.avatarUrl;
    if (!avatarUrl || avatarUrl.includes('apppicture.png')) {
      avatarUrl = 'https://via.placeholder.com/150';
    }

    const bio = userData.bio || 'Welcome to my official channel!';

    let videosSnapshot = await firebase.firestore()
      .collection('videos')
      .where('uploaderUid', '==', targetUid)
      .get();

    if (videosSnapshot.empty) {
      videosSnapshot = await firebase.firestore()
        .collection('videos')
        .where('userId', '==', targetUid)
        .get();
    }

    let videoCardsHtml = '';
    if (videosSnapshot.empty) {
      videoCardsHtml = `
        <div style="text-align: center; padding: 40px; color: #888; width: 100%;">
          <p>This channel doesn't have any content</p>
        </div>`;
    } else {
      videosSnapshot.forEach(doc => {
        const v = doc.data();
        videoCardsHtml += `
          <div style="width: 280px; margin: 10px; display: inline-block; text-align: left; background: #181818; padding: 10px; border-radius: 8px; vertical-align: top;">
            <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 6px; background: #000;">
              <iframe 
                src="https://www.youtube-nocookie.com/embed/${v.youtubeVideoId}?autoplay=0&rel=0&modestbranding=1" 
                title="${escapeHtml(v.title || 'Video')}"
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen
                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;">
              </iframe>
            </div>
            <p style="font-weight: bold; margin: 8px 0 2px; color: #fff; font-size: 0.95rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(v.title || 'Untitled')}</p>
            ${v.description ? `<p style="color: #aaa; font-size: 0.8rem; margin: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(v.description)}</p>` : ''}
          </div>`;
      });
    }

    profileContainer.innerHTML = `
      <div style="padding: 20px; color: #fff;">
        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
          <div style="position: relative;">
            <img id="profile-avatar-img" 
                 src="${avatarUrl}" 
                 onerror="this.onerror=null;this.src='https://via.placeholder.com/150';" 
                 style="width: 110px; height: 110px; border-radius: 50%; object-fit: cover; border: 2px solid #333; background: #222;" />
            ${isOwner ? `
              <button onclick="document.getElementById('avatar-file-input').click()" style="position: absolute; bottom: 0; right: 0; background: #0088ff; border: none; color: #fff; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Change Picture">📷</button>
              <input type="file" id="avatar-file-input" accept="image/*" style="display:none;" onchange="uploadProfilePicture(event, '${targetUid}')" />
            ` : ''}
          </div>

          <div>
            <h2 style="margin: 0; font-size: 1.8rem;">${escapeHtml(displayName)}</h2>
            <p style="margin: 4px 0; color: #aaa;">${escapeHtml(handle)} • <span id="sub-count-display">${subscribersCount}</span> subscribers</p>
            <p style="margin: 4px 0; color: #ddd; font-size: 0.9rem;">${escapeHtml(bio)}</p>

            <div style="margin-top: 12px; display: flex; gap: 10px; align-items: center;">
              ${isOwner ? `
                <button onclick="editChannelDetails()" style="padding: 8px 16px; background: #333; color: #fff; border: 1px solid #555; border-radius: 20px; cursor: pointer;">Customize channel</button>
                <button onclick="manageVideos()" style="padding: 8px 16px; background: #333; color: #fff; border: 1px solid #555; border-radius: 20px; cursor: pointer;">Manage videos</button>
              ` : `
                <button onclick="toggleSubscribe('${targetUid}')" style="padding: 8px 18px; background: #cc0000; color: #fff; border: none; border-radius: 20px; font-weight: bold; cursor: pointer;">Subscribe</button>
              `}

              ${isAdminUser ? `
                <button onclick="adminOverrideStats('${targetUid}', 'users', 'subscribersCount', prompt('Set new subscriber count:', '${subscribersCount}'))" style="background: #ffd700; color: #000; border: none; padding: 6px 14px; border-radius: 16px; font-weight: bold; cursor: pointer; font-size: 12px;">
                  👑 Edit Subscribers
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <hr style="border-color: #333; margin: 20px 0;" />

        <div>
          <h3 style="margin-bottom: 15px;">Uploaded Videos</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">${videoCardsHtml}</div>
        </div>
      </div>
    `;

  } catch (err) {
    console.error("Error opening profile:", err);
    profileContainer.innerHTML = `<p style="color: #ff5555;">Error loading profile: ${err.message}</p>`;
  }
}

// Upload and Update Profile Picture (Owner only)
async function uploadProfilePicture(event, uid) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const fileName = `avatars/${uid}_${Date.now()}`;
    const { data, error } = await supabase.storage.from('streamkids-videos').upload(fileName, file);

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage.from('streamkids-videos').getPublicUrl(fileName);
    const newAvatarUrl = publicUrlData.publicUrl;

    await firebase.firestore().collection('users').doc(uid).set({
      avatarUrl: newAvatarUrl
    }, { merge: true });

    const imgElem = document.getElementById('profile-avatar-img');
    if (imgElem) imgElem.src = newAvatarUrl;

    alert("Profile picture updated successfully!");
  } catch (err) {
    console.error("Failed to update profile picture:", err);
    alert("Failed to upload image: " + err.message);
  }
}

// Placeholder functions for profile actions
function editChannelDetails() {
  alert("Customize Channel panel coming soon!");
}

function manageVideos() {
  alert("Manage Videos panel coming soon!");
}

// ==========================================
// 👥 REAL-TIME SUBSCRIPTION TRANSACTION
// ==========================================
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
        // Unsubscribe
        subscriptions.splice(subIndex, 1);
        currentSubCount = Math.max(0, currentSubCount - 1);
      } else {
        // Subscribe
        subscriptions.push(targetUid);
        currentSubCount += 1;
        isSubbed = true;
      }

      // Update creator's subscriber count in Firestore
      transaction.set(targetUserRef, {
        subscribersCount: currentSubCount
      }, { merge: true });

      // Update current user's subscriptions list in Firestore
      transaction.set(currentUserRef, {
        subscriptions: subscriptions
      }, { merge: true });

      // Update UI Counters & Buttons Immediately
      const subDisplay = document.getElementById('sub-count-display');
      if (subDisplay) subDisplay.innerText = currentSubCount.toLocaleString();

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

// Helper to escape special HTML characters to prevent XSS issues
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// File Selection Handler
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
window.openChannelProfile = openChannelProfile;
window.uploadProfilePicture = uploadProfilePicture;
window.editChannelDetails = editChannelDetails;
window.manageVideos = manageVideos;
window.toggleSubscribe = toggleSubscribe;
window.handleFileSelect = handleFileSelect;
window.handleLikeVideo = handleLikeVideo;
window.shareVideo = shareVideo;
window.adminOverrideStats = adminOverrideStats;
