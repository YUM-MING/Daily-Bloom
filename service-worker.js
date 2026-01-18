const CACHE_NAME = 'daily-bloom-v2'; // 버전을 올려서 강제 갱신 유도
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/firebase-config.js',
  '/assets/logo.svg',
  '/assets/bell.svg',
  '/assets/camera.svg',
  '/assets/header-bg.svg',
  '/assets/moon.svg',
  '/assets/search.svg',
  '/assets/lock.svg'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // 새 서비스 워커가 즉시 활성화되도록 강제
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // 이전 버전 캐시 삭제
          }
        })
      );
    })
  );
  self.clients.claim(); // 즉시 제어권 획득
});

// Fetch Event (Network First Strategy for App Files)
self.addEventListener('fetch', (event) => {
  // 외부 API 호출은 캐싱 제외
  if (event.request.url.includes('firestore') || event.request.url.includes('googleapis')) {
    return;
  }

  // 핵심 파일들은 '네트워크 우선' 방식으로 조회 (인터넷 있으면 무조건 새것)
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request); // 오프라인일 때만 캐시 사용
    })
  );
});

// Push Notification Event
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Daily Bloom';
  const options = {
    body: data.body || 'New notification!',
    icon: '/assets/logo.svg',
    badge: '/assets/logo.svg',
    data: data.url || '/'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});