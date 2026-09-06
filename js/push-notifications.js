// JFlix Push Notifications Client
// Automatic system-level push notifications — NO button, NO icon
// Works on: Web Browser, Electron App, Android App (via PWA/TWA)
// Auto-subscribes users silently, sends native OS notifications when new content arrives

const PUSH_API = (window.API_URL || 'https://jflix.uk/api').replace('/api', '') + '/api/push';

// Initialize push notifications — automatic, no user interaction needed
async function initPushNotifications() {
  // Check if push is supported in this environment
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] Not supported in this browser/app');
    return;
  }

  // Register service worker (needed for push even when site is closed)
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('[Push] Service Worker registered:', reg.scope);
  } catch (e) {
    // Expected inside the Electron app shell (no ServiceWorker there) — push
    // simply stays off for this session instead of throwing red console errors.
    console.log('[Push] SW unavailable, push disabled for this session:', e && e.message ? e.message : e);
    return;
  }

  // Auto-subscribe after a short delay (let page load first)
  setTimeout(autoSubscribePush, 3000);
}

// Auto-subscribe to push notifications silently
// Uses "soft" permission request — only asks once, remembers choice
async function autoSubscribePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const existingSub = await reg.pushManager.getSubscription();

    // Already subscribed — nothing to do
    if (existingSub) {
      // Verify subscription is still registered on server
      await verifySubscription(existingSub);
      return;
    }

    // Check if user previously denied — don't ask again
    if (localStorage.getItem('jflix_push_denied') === 'true') {
      return;
    }

    // Check if user previously dismissed — don't auto-prompt again
    if (localStorage.getItem('jflix_push_dismissed') === 'true') {
      return;
    }

    // Request permission (this shows the browser's native notification permission dialog)
    // On Electron: shows native OS dialog
    // On Android PWA: shows native Android notification permission dialog
    // On Web browser: shows browser notification prompt
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      // Subscribe to push
      const keyRes = await fetch(`${PUSH_API}/vapid-key`);
      const keyData = await keyRes.json();

      if (!keyData.success) {
        console.error('[Push] Failed to get VAPID key');
        return;
      }

      const publicKey = urlBase64ToUint8Array(keyData.publicKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });

      // Send subscription to server
      const userId = localStorage.getItem('jflix_user_id') || null;
      await fetch(`${PUSH_API}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, userId })
      });

      console.log('[Push] Auto-subscribed successfully');
      localStorage.removeItem('jflix_push_dismissed');

      // Show a welcome notification (system-level)
      showSystemNotification(
        'JFlix Notifications Enabled',
        'You will now receive notifications when new movies and TV shows are added.',
        '/images/icon-192x192.png'
      );
    } else if (permission === 'denied') {
      localStorage.setItem('jflix_push_denied', 'true');
      console.log('[Push] User denied notifications');
    } else {
      // Permission dismissed — try again next visit
      localStorage.setItem('jflix_push_dismissed', 'true');
      console.log('[Push] Permission dismissed');
    }
  } catch (e) {
    console.error('[Push] Auto-subscribe error:', e);
  }
}

// Verify subscription is still registered on server
async function verifySubscription(subscription) {
  try {
    // Re-send to ensure server has it
    const userId = localStorage.getItem('jflix_user_id') || null;
    await fetch(`${PUSH_API}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, userId })
    });
  } catch (e) {
    console.error('[Push] Verify error:', e);
  }
}

// Show a system-level notification (native OS notification)
function showSystemNotification(title, body, icon) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const options = {
      body: body,
      icon: icon || '/images/icon-192x192.png',
      badge: '/images/icon-192x192.png',
      tag: 'jflix-notification',
      requireInteraction: false,
      silent: false,
      data: { url: 'https://jflix.uk' }
    };

    // Use service worker notification if available (works when tab is closed)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      }).catch(() => {
        // Fallback to regular notification
        new Notification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  } catch (e) {
    console.error('[Push] Notification error:', e);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Initialize on page load — fully automatic, no UI element
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initPushNotifications, 2000));
} else {
  setTimeout(initPushNotifications, 2000);
}
