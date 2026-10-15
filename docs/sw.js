// 오프라인 대비: 화면 파일은 저장해 두고, 자료(data/)는 항상 최신을 먼저 시도
// 저장할 때는 ?v= 같은 꼬리표를 떼고 주소(경로)로 저장 → 오프라인에서 app.js?v=46 요청도 찾을 수 있게
const CACHE = 'kidclinic-v30';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'growth-data.js', 'kid.js', 'care.js', 'scan.js', 'i18n.js', 'triage.js', 'config.js', 'privacy.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/favicon-32.png', 'icons/apple-touch-icon.png', 'vendor/jua/jua.css',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css'];
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
  const key = url.origin + url.pathname; // 꼬리표(?v=, ?t=) 없이 저장·찾기
  // 인터넷 먼저, 안 되면 저장본
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key, { ignoreSearch: true }).then((r) => {
      if (r) return r;
      if (req.mode === 'navigate') return caches.match('index.html', { ignoreSearch: true });
      return new Response('', { status: 504, statusText: 'offline' });
    }))
  );
});
