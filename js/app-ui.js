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
async function uploadKidVideo(file, title, description, category = 'gaming') {
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

    // 3. Save Video ID, Category & Engagement Stats to Firestore
    await firebase.firestore().collection('videos').add({
      title: title || 'StreamKids Video',
      description: description || 'Uploaded on StreamKids',
      youtubeVideoId: realVideoId,
      category: category,
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
      document.querySelectorAll('#upload-tab input, #upload-tab textarea, #upload-tab select').forEach(input => input.value = '');
    }
    showTab('fyp-tab');

  } catch (err) {
    console.error('Upload Error:', err);
    if (uploadStatus) uploadStatus.innerText = 'Upload failed: ' + err.message;
    alert('Upload failed: ' + err.message);
  }
}

// Global variable to store fetched FYP videos for instant filtering
let allFYPVideos = [];

// Loads and renders videos with YouTube Thumbnail -> Player Switcher, Likes, Comments & Share
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

// Render filtered video list with search query & category
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
    const authorName = data.uploaderName || data.userName || 'Guest User';
    const uploaderUid = data.uploaderUid || data.userId || data.uid || data.authorId || '';
    const likesCount = data.likesCount || 0;

    // High-res YouTube thumbnail URL with fallback
    const thumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;

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
      
      <!-- YouTube Thumbnail Container (Swaps to Player on Click) -->
      <div id="media-container-${videoId}" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; background: #000; cursor: pointer;" onclick="playThumbnailVideo('${videoId}', '${ytId}')" title="Click to play video">
        <img src="${thumbUrl}" alt="Video Thumbnail" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/480x360?text=StreamKids+Video'" />
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; border: 2px solid #fff;">
          <div style="width: 0; height: 0; border-top: 12px solid transparent; border-bottom: 12px solid transparent; border-left: 20px solid #fff; margin-left: 4px;"></div>
        </div>
      </div>

      ${data.description ? `<p style="margin-top: 8px; color: #dddddd;">${escapeHtml(data.description)}</p>` : ''}

      <!-- Engagement Bar (Likes, Comments & Share) -->
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

      <!-- Collapsible Comment Box -->
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

// Swap Thumbnail for Live Embedded YouTube Player on Click
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

// Toggle Comments Box Visibility
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

// Load Video Comments from Firestore
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

// Post a New Comment
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

    input.value = ''; // Clear input
  } catch (err) {
    console.error("Failed to post comment:", err);
    alert("Failed to post comment: " + err.message);
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

// ==========================================
// 🎨 CHANNEL BUILDER & STUDIO (Owner Tools)
// ==========================================
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

      // Save directly to Firestore (Auth updateProfile removed to fix length error)
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

// Edit Bio & Social Link
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

// Change Banner Image URL
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
