// JFlix Service Worker for PWA - v10
const CACHE_NAME = 'jflix-pwa-v10';

// Check if request is for player page on iOS PWA
function isIOSPWAPlayer(url) {
  return url.pathname.includes('player.html') && 
         url.searchParams.has('ios') && 
         url.searchParams.get('ios') === 'pwa';
}

// Install event - skip waiting immediately, cache nothing to avoid failures
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing v10...');
  event.waitUntil(self.skipWaiting());
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating v10...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        return self.clients.claim();
      })
  );
});

// Push notification event — system-level notification on all platforms
// Works on: Web Browser, Electron App, Android PWA/TWA
self.addEventListener('push', event => {
  console.log('[Service Worker] Push notification received');
  
  let data = {
    title: 'JFlix',
    body: 'New content available!',
    icon: '/images/icon-192x192.png',
    badge: '/images/icon-192x192.png',
    url: '/',
    image: null,
    tag: 'jflix-notification',
    actions: []
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.error('[Service Worker] Failed to parse push data:', e);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200],
    tag: data.tag || 'jflix-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    data: {
      url: data.url || '/'
    },
    actions: data.actions && data.actions.length > 0 ? data.actions : [
      {
        action: 'open',
        title: '▶ Watch Now'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  // Add image if provided (movie poster)
  if (data.image) {
    options.image = data.image;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event — handle action buttons
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification clicked:', event.action);
  
  event.notification.close();

  // Handle dismiss action
  if (event.action === 'dismiss') {
    return;
  }

  // Get URL from notification data
  const targetUrl = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If a JFlix window is already open, navigate it and focus
        for (const client of clientList) {
          if (client.url.includes('jflix')) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', event => {
  console.log('[Service Worker] Notification closed');
});

// Fetch event - Network first for all requests
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Allow video server domains (needed for playback)
  const VIDEO_SERVER_DOMAINS = [
    'vsembed.ru', 'player.videasy.net', '2embed.cc',
    'vidsrc.to', 'multiembed.mov', 'vidvault.ru'
  ];
  if (VIDEO_SERVER_DOMAINS.some(d => url.hostname.includes(d))) {
    // Pass through directly to network, no caching
    event.respondWith(fetch(event.request));
    return;
  }

  // For same-origin requests, use network-first with cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Only cache valid same-origin responses
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed - try cache
          console.log('[Service Worker] Network failed, trying cache:', event.request.url);
          return caches.match(event.request);
        })
    );
  }
});
