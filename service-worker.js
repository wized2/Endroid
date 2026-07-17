const CACHE_NAME = 'endroid_v3.0.1';
const BASE_PATH = '/';

// Files to cache for offline use
const urlsToCache = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'favicon.png',
  BASE_PATH + 'manifest.json',
  // Correct font URLs from your HTML
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
  // Pre-cache font files for better offline support
  'https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Mu4mxM.woff2',
  'https://fonts.gstatic.com/s/montserrat/v29/JTUSjIg1_i6t8kCHKm459Wlhyw.woff2',
  'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2'
];

// Install event - cache all necessary files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache.map(url => {
          // Handle potential URL issues
          try {
            return new Request(url, { mode: 'no-cors' });
          } catch (e) {
            console.warn('[Service Worker] Failed to create request for:', url, e);
            return url;
          }
        }));
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      console.log('[Service Worker] Activating new version');
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Enhanced fetch event with better caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests with appropriate strategies
  if (url.origin === self.location.origin) {
    // Local resources: Cache First, fallback to network
    event.respondWith(cacheFirstWithUpdate(request));
  } else if (url.origin === 'https://fonts.googleapis.com' || 
             url.origin === 'https://fonts.gstatic.com') {
    // Fonts: Cache First, Stale-While-Revalidate
    event.respondWith(cacheFirstWithRevalidate(request));
  } else {
    // External resources: Network First, fallback to cache
    event.respondWith(networkFirst(request));
  }
});

// Cache First Strategy with background update
async function cacheFirstWithUpdate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Return cached response immediately
  if (cachedResponse) {
    // Update cache in background if possible
    updateCacheInBackground(request, cache);
    return cachedResponse;
  }
  
  // If not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);
    
    // Cache the new response
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);
    
    // If it's a page request and we're offline, serve index.html
    if (request.mode === 'navigate') {
      const fallback = await cache.match(BASE_PATH + 'index.html');
      if (fallback) return fallback;
    }
    
    // Return offline page or error
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'text/plain' })
    });
  }
}

// Cache First with Stale-While-Revalidate for fonts
async function cacheFirstWithRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Always try to update from network in background
  fetch(request).then(async networkResponse => {
    if (networkResponse.ok) {
      await cache.put(request, networkResponse);
    }
  }).catch(() => {
    // Silently fail if network update fails
  });
  
  // Return cached response if available, otherwise fetch
  return cachedResponse || fetch(request);
}

// Network First Strategy for external resources
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('[Service Worker] Network failed, trying cache:', error);
    
    // Fallback to cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If all else fails, return error
    throw error;
  }
}

// Background cache update
async function updateCacheInBackground(request, cache) {
  try {
    const networkResponse = await fetch(request);
    
    // Only update if response is different/newer
    const cachedResponse = await cache.match(request);
    if (!cachedResponse || 
        networkResponse.headers.get('etag') !== cachedResponse.headers.get('etag') ||
        new Date(networkResponse.headers.get('last-modified')) > 
        new Date(cachedResponse.headers.get('last-modified'))) {
      await cache.put(request, networkResponse.clone());
      console.log('[Service Worker] Background cache updated for:', request.url);
    }
  } catch (error) {
    // Silently fail - we already have cached version
  }
}

// Handle messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});
