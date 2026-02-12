// FirstLook Service Worker
// 最小実装: Network-First戦略

const CACHE_NAME = 'firstlook-v1';

// インストール時
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  // すぐにアクティブ化
  self.skipWaiting();
});

// アクティベート時
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    // 古いキャッシュをクリア
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // すぐに制御を開始
      return self.clients.claim();
    })
  );
});

// Fetch時: Network-First（基本はネットワーク優先、失敗時のみキャッシュ）
self.addEventListener('fetch', (event) => {
  // POSTリクエストやAPI呼び出しはキャッシュしない
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 成功したレスポンスをキャッシュに保存
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // ネットワークエラー時はキャッシュから返す
        return caches.match(event.request);
      })
  );
});
