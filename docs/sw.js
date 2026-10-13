// 오프라인 대비: 화면 파일은 저장해 두고, 자료(data/)는 항상 최신을 먼저 시도
const CACHE = 'kidclinic-v19';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'growth-data.js', 'kid.js', 'care.js', 'scan.js', 'i18n.js', 'triage.js', 'config.js', 'privacy.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 지도 타일 등 외부는 그대로
  // 인터넷 먼저, 안 되면 저장본
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(url.pathname.endsWith('.json') ? url.pathname : req, copy)); }
      return res;
    }).catch(() => caches.match(url.pathname.endsWith('.json') ? url.pathname : req).then((r) => r || caches.match('index.html')))
  );
});
