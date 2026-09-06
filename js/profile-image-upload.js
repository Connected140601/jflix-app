// JFlix Profile Image Upload
// Handles avatar upload to R2 via backend API for Android/Supabase users
// Version 1.0

(function() {
  'use strict';

  const API_URL = 'https://jflix-api.junrel-sapantaicloud.workers.dev/api';
  const MAX_BYTES = 3 * 1024 * 1024; // 3 MB

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function getToken() {
    return (window.jflixAuth && window.jflixAuth.token) ||
           localStorage.getItem('jflix_auth_token') || null;
  }

  function isAndroidSupabaseUser() {
    const ua = navigator.userAgent;
    const isAndroid = /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(ua) ||
                      (typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID);
    return isAndroid && !!getToken();
  }

  // Compress image client-side if > 3MB via canvas
  function compressImage(file, maxBytes) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let quality = 0.85;
          let scale   = 1;

          // Downscale if very large
          const MAX_DIM = 800;
          if (img.width > MAX_DIM || img.height > MAX_DIM) {
            scale = MAX_DIM / Math.max(img.width, img.height);
          }

          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.width  * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Reduce quality until under limit
          const tryEncode = (q) => {
            const dataUrl = canvas.toDataURL('image/jpeg', q);
            const bytes   = Math.round((dataUrl.length - 22) * 3 / 4);
            if (bytes <= maxBytes || q <= 0.2) return dataUrl;
            return tryEncode(q - 0.1);
          };

          resolve(tryEncode(quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Upload to backend (stores in R2, returns URL) ────────────────────────────

  async function uploadAvatarToBackend(base64DataUrl) {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');

    // Convert base64 to Blob for multipart upload
    const arr  = base64DataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    const blob = new Blob([u8], { type: mime });

    const formData = new FormData();
    formData.append('avatar', blob, 'avatar.jpg');

    const response = await fetch(`${API_URL}/auth/profile/avatar`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) {
      // Fallback: store base64 directly in profile if endpoint missing
      if (response.status === 404) {
        return await uploadAvatarAsBase64(base64DataUrl, token);
      }
      throw new Error(`Upload failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Upload failed');
    return data.avatarUrl;
  }

  // Fallback: save base64 directly via profile update
  async function uploadAvatarAsBase64(base64DataUrl, token) {
    const response = await fetch(`${API_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ avatarUrl: base64DataUrl })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Profile update failed');
    return base64DataUrl;
  }

  // ── Update avatar everywhere in the UI ──────────────────────────────────────

  function updateAvatarUI(url) {
    // Profile modal
    const pmAv = document.getElementById('pm-avatar');
    if (pmAv) { pmAv.src = url; pmAv.onerror = null; }

    // Nav avatar
    document.querySelectorAll('.user-avatar').forEach(el => {
      el.src = url;
      el.onerror = null;
    });

    // Preview in upload widget
    const prevImg = document.getElementById('piu-preview');
    if (prevImg) { prevImg.src = url; prevImg.onerror = null; }

    // Persist in localStorage so it loads instantly on next visit
    try {
      const stored = localStorage.getItem('jflix_user');
      if (stored) {
        const u = JSON.parse(stored);
        u.avatarUrl = url;
        localStorage.setItem('jflix_user', JSON.stringify(u));
      }
    } catch(e) {}

    // Sync with jflixAuth.user
    if (window.jflixAuth && window.jflixAuth.user) {
      window.jflixAuth.user.avatarUrl = url;
    }
  }

  // ── Upload modal / picker UI ─────────────────────────────────────────────────

  function showUploadUI(currentAvatarUrl) {
    if (document.getElementById('piu-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'piu-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:2000000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;backdrop-filter:blur(12px);';

    overlay.innerHTML = `
      <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:20px;max-width:380px;width:100%;padding:0;box-shadow:0 30px 80px rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.1);overflow:hidden;">

        <!-- Header -->
        <div style="padding:20px 22px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.07);">
          <div style="color:#fff;font-size:16px;font-weight:700;">Change Profile Photo</div>
          <button id="piu-close" style="background:none;border:none;color:#666;font-size:22px;cursor:pointer;padding:0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:all 0.2s;"
            onmouseover="this.style.color='#fff';this.style.background='rgba(255,255,255,0.1)'"
            onmouseout="this.style.color='#666';this.style.background='none'">&times;</button>
        </div>

        <!-- Preview -->
        <div style="padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px;">
          <div style="position:relative;">
            <img id="piu-preview" src="${currentAvatarUrl || 'images/icon-192x192.png'}" alt="Preview"
              style="width:110px;height:110px;border-radius:50%;object-fit:cover;border:4px solid rgba(229,9,20,0.5);background:#1a1a2e;display:block;"
              onerror="this.src='images/icon-192x192.png'">
            <div id="piu-spinner" style="display:none;position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,0.6);align-items:center;justify-content:center;">
              <i class="fas fa-spinner fa-spin" style="color:#fff;font-size:24px;"></i>
            </div>
          </div>

          <!-- Size note -->
          <div style="color:#666;font-size:12px;text-align:center;">Maximum size: <strong style="color:#aaa;">3 MB</strong> · JPG, PNG, WEBP</div>

          <!-- Status -->
          <div id="piu-status" style="display:none;font-size:13px;padding:10px 14px;border-radius:10px;width:100%;box-sizing:border-box;text-align:center;"></div>

          <!-- Buttons -->
          <input type="file" id="piu-file-input" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none;">

          <button id="piu-choose-btn"
            style="width:100%;background:linear-gradient(135deg,#e50914,#b0060f);color:#fff;border:none;padding:14px;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 0.2s;"
            onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 8px 24px rgba(229,9,20,0.5)'"
            onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">
            <i class="fas fa-camera"></i> Choose Photo
          </button>

          <button id="piu-upload-btn" style="display:none;width:100%;background:linear-gradient(135deg,#2ecc71,#27ae60);color:#fff;border:none;padding:14px;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;display:none;align-items:center;justify-content:center;gap:10px;transition:all 0.2s;"
            onmouseover="this.style.transform='translateY(-1px)'"
            onmouseout="this.style.transform='translateY(0)'">
            <i class="fas fa-cloud-upload-alt"></i> Save Photo
          </button>

          <button id="piu-remove-btn"
            style="width:100%;background:transparent;border:1px solid rgba(255,255,255,0.1);color:#666;padding:11px;border-radius:12px;font-size:13px;cursor:pointer;transition:all 0.2s;"
            onmouseover="this.style.borderColor='rgba(229,9,20,0.4)';this.style.color='#e50914'"
            onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';this.style.color='#666'">
            <i class="fas fa-trash-alt"></i> Remove Photo
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const fileInput  = document.getElementById('piu-file-input');
    const chooseBtn  = document.getElementById('piu-choose-btn');
    const uploadBtn  = document.getElementById('piu-upload-btn');
    const removeBtn  = document.getElementById('piu-remove-btn');
    const preview    = document.getElementById('piu-preview');
    const spinner    = document.getElementById('piu-spinner');
    const statusEl   = document.getElementById('piu-status');
    const closeBtn   = document.getElementById('piu-close');

    let pendingDataUrl = null;

    function showStatus(msg, isError) {
      statusEl.style.display = 'block';
      statusEl.style.background = isError ? 'rgba(229,9,20,0.15)' : 'rgba(46,204,113,0.15)';
      statusEl.style.color      = isError ? '#e50914' : '#2ecc71';
      statusEl.style.border     = isError ? '1px solid rgba(229,9,20,0.2)' : '1px solid rgba(46,204,113,0.2)';
      statusEl.textContent = msg;
    }

    function setSpinner(on) {
      spinner.style.display = on ? 'flex' : 'none';
    }

    // File selected
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      statusEl.style.display = 'none';

      // Validate type
      if (!file.type.startsWith('image/')) {
        showStatus('Please select an image file.', true);
        return;
      }

      // Validate size (3MB raw)
      if (file.size > MAX_BYTES) {
        showStatus('Compressing image...', false);
      }

      try {
        const dataUrl = await compressImage(file, MAX_BYTES);
        const finalBytes = Math.round((dataUrl.length - 22) * 3 / 4);

        if (finalBytes > MAX_BYTES) {
          showStatus('Image too large even after compression. Please choose a smaller photo.', true);
          return;
        }

        pendingDataUrl = dataUrl;
        preview.src = dataUrl;
        preview.onerror = null;

        // Show upload button
        uploadBtn.style.display = 'flex';
        chooseBtn.textContent = '';
        chooseBtn.innerHTML = '<i class="fas fa-camera"></i> Choose Different Photo';
        statusEl.style.display = 'none';

        const kb = Math.round(finalBytes / 1024);
        showStatus(`Photo ready (${kb} KB). Tap Save to upload.`, false);

      } catch(err) {
        showStatus('Failed to process image. Try another.', true);
      }

      fileInput.value = '';
    });

    chooseBtn.addEventListener('click', () => fileInput.click());

    // Upload
    uploadBtn.addEventListener('click', async () => {
      if (!pendingDataUrl) return;

      uploadBtn.disabled = true;
      chooseBtn.disabled = true;
      uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
      setSpinner(true);
      statusEl.style.display = 'none';

      try {
        const avatarUrl = await uploadAvatarToBackend(pendingDataUrl);
        updateAvatarUI(avatarUrl);
        setSpinner(false);
        showStatus('Profile photo updated!', false);

        uploadBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        setTimeout(() => closeOverlay(), 1500);

      } catch(err) {
        setSpinner(false);
        uploadBtn.disabled = false;
        chooseBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Save Photo';
        showStatus('Upload failed. Please try again.', true);
        console.error('[Avatar Upload]', err);
      }
    });

    // Remove photo
    removeBtn.addEventListener('click', async () => {
      removeBtn.disabled = true;
      removeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      try {
        const token = getToken();
        await fetch(`${API_URL}/auth/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ avatarUrl: null })
        });
        updateAvatarUI('images/icon-192x192.png');
        closeOverlay();
      } catch(e) {
        removeBtn.disabled = false;
        removeBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Remove Photo';
        showStatus('Failed to remove photo.', true);
      }
    });

    function closeOverlay() {
      const el = document.getElementById('piu-overlay');
      if (el) el.remove();
    }

    closeBtn.addEventListener('click', closeOverlay);
  }

  // ── Add camera button to avatar in profile modal ─────────────────────────────

  function injectUploadButton() {
    // Only for Android Supabase users
    if (!isAndroidSupabaseUser()) return;

    const avatarWrap = document.querySelector('#pm-header > div:first-child');
    if (!avatarWrap || document.getElementById('piu-change-btn')) return;

    const av = document.getElementById('pm-avatar');
    const currentUrl = av ? av.src : '';

    const btn = document.createElement('button');
    btn.id = 'piu-change-btn';
    btn.title = 'Change photo';
    btn.style.cssText = [
      'position:absolute',
      'bottom:-2px',
      'right:-2px',
      'width:26px',
      'height:26px',
      'background:linear-gradient(135deg,#e50914,#b0060f)',
      'border:2px solid #141428',
      'border-radius:50%',
      'color:#fff',
      'font-size:11px',
      'cursor:pointer',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:10',
      'transition:all 0.2s',
      'box-shadow:0 2px 8px rgba(229,9,20,0.5)'
    ].join(';');
    btn.innerHTML = '<i class="fas fa-camera"></i>';

    btn.addEventListener('mouseover', () => btn.style.transform = 'scale(1.1)');
    btn.addEventListener('mouseout',  () => btn.style.transform = 'scale(1)');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showUploadUI(currentUrl);
    });

    avatarWrap.style.position = 'relative';
    avatarWrap.appendChild(btn);
  }

  // Expose so profile modal can call it
  window.JFlixProfileUpload = {
    injectButton: injectUploadButton,
    showUploadUI
  };

  // Auto-inject when profile modal opens
  const observer = new MutationObserver(() => {
    if (document.getElementById('pm-avatar') && !document.getElementById('piu-change-btn')) {
      injectUploadButton();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    // Fallback: try to observe when body is available
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

})();
