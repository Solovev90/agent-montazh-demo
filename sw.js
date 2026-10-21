/* Service worker PWA: кэш оболочки (сеть сначала для страниц, кэш для статики), push о готовом ролике,
   клик по уведомлению открывает ролик. Видео и ответы API не кэшируем. */
const CACHE = 'shell-v3'  // v3: иконки логотипа № 7 под прежними именами — старый кэш удаляется
// Пути от папки, где лежит sw.js: сайт в корне домена или демо в подпапке (этап 4.2)
const BASE = new URL('./', self.location).pathname
const SHELL = [BASE, BASE + 'manifest.webmanifest', BASE + 'icons/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (!url.pathname.startsWith(BASE)) return
  const path = url.pathname.slice(BASE.length)  // путь внутри приложения: 'assets/…', 'api/…'
  if (path.startsWith('api/') || path.startsWith('s3/')) return
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone()
      caches.open(CACHE).then((c) => c.put(BASE, copy))
      return r
    }).catch(() => caches.match(BASE)))
    return
  }
  if (path.startsWith('assets/') || path.startsWith('icons/') || path.startsWith('img/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      const copy = r.clone()
      caches.open(CACHE).then((c) => c.put(e.request, copy))
      return r
    })))
  }
})

self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch (_) {
    data = { title: e.data ? e.data.text() : '' }
  }
  e.waitUntil(self.registration.showNotification(data.title || '', {
    body: data.body || '',
    icon: BASE + 'icons/icon-192.png',
    badge: BASE + 'icons/icon-192.png',
    tag: data.order_id || 'order',
    data: { url: data.url || BASE },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || BASE
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if ('focus' in c) {
        c.navigate(url)
        return c.focus()
      }
    }
    return self.clients.openWindow(url)
  }))
})
