/* ===========================================================
   عامل الخدمة — يجعل اللعبة تعمل عند ضعف الشبكة أو انقطاعها
   السياسة: ملفات الموقع «الشبكة أولاً» حتى يظهر أي تحديث فور رفعه،
            والذاكرة احتياطٌ عند الانقطاع. الخطوط «الذاكرة أولاً».
   =========================================================== */
const CACHE = 'sirah-cards-v3';
const SHELL = [
  '/', '/index.html', '/game.js', '/questions.js',
  '/favicon.svg', '/manifest.webmanifest', '/og.png'
];
const FONT_HOSTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // allSettled: لو تعذّر ملف واحد لا يسقط التثبيت كله
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch(err){ return; }

  if(FONT_HOSTS.includes(url.origin)){
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  if(url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if(res && res.ok && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit =>
        hit || (req.mode === 'navigate' ? caches.match('/index.html') : undefined)
      ))
  );
});
