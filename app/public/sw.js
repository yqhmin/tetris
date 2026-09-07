/* 俄罗斯方块 PWA Service Worker
 * 策略：一律网络优先（保证更新及时），离线时回退缓存（保证离线可玩）
 * 静态文件，无需构建期注入
 */
const CACHE = 'tetris-v2'

async function putCache(request, response) {
  if (response.ok) {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest', './favicon.svg']))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return
  event.respondWith(
    fetch(event.request)
      .then((res) => putCache(event.request, res))
      .catch(async () => {
        const hit = await caches.match(event.request, { ignoreSearch: true })
        return hit || (await caches.match('./index.html'))
      })
  )
})
