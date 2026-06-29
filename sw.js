/* ===================================================
   sw.js - PWA 서비스 워커 (설치 지원용)
   네트워크 우선 전략 — 항상 최신 데이터 사용
   =================================================== */

var CACHE = 'samyang-erp-v1';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  // 네트워크 우선 — Supabase API 등 항상 최신 데이터 보장
  e.respondWith(fetch(e.request).catch(function() { return caches.match(e.request); }));
});
