// Little Mandala's service worker: keeps the children's screens working without the internet.
//
// Children's screens are fetched fresh while online and a copy is kept, so they still open offline.
// Build files are content-hashed, so a kept copy never goes stale. The grown-up area, sign-in,
// payments and the API are never kept: they always need the internet.
//
// Served as-is from /sw.js (see the headers in next.config.mjs). Raising VERSION drops every kept copy.

const VERSION = 1
const PAGES = `lm-pages-v${VERSION}`
const FILES = `lm-files-v${VERSION}`
const OFFLINE_PAGE = '/offline.html'
/** How long a page may take online before a kept copy is shown instead. */
const NETWORK_TIMEOUT_MS = 4000

/** The children's screens. Everything else needs the internet. */
function isKidPage(pathname) {
  return pathname === '/' || pathname === '/garden' || pathname.startsWith('/packs/') || pathname.startsWith('/color/')
}

const isBuildFile = (pathname) => pathname.startsWith('/_next/static/')

/** Build files named in a page or another build file, such as each picture's outline. */
function findBuildFiles(text) {
  const found = new Set()
  for (const [path] of text.matchAll(/static\/[A-Za-z0-9_\-./]+?\.(?:js|css|woff2)/g)) {
    found.add(`/_next/${path}`)
  }
  return found
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.add(OFFLINE_PAGE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith('lm-') && key !== PAGES && key !== FILES).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (isBuildFile(url.pathname)) {
    event.respondWith(buildFile(request, url))
  } else if (request.headers.get('RSC') === '1') {
    event.respondWith(pageData(request))
  } else if (request.mode === 'navigate') {
    event.respondWith(isKidPage(url.pathname) ? kidPage(request, url) : needsInternet(request))
  }
})

async function buildFile(request, url) {
  const cache = await caches.open(FILES)
  const kept = await cache.match(url.pathname)
  if (kept) return kept
  const response = await fetch(request)
  if (response.ok) await cache.put(url.pathname, response.clone())
  return response
}

/**
 * Next.js fetches a page's data in the background when a child taps a link. Offline, answering
 * "unavailable" makes Next.js load the page normally instead, and that load is served from the
 * kept copy below.
 */
function pageData(request) {
  return fetch(request).catch(() => new Response(null, { status: 503, statusText: 'Offline' }))
}

async function kidPage(request, url) {
  const cache = await caches.open(PAGES)
  // `?art=` opens a garden picture on the same page, so one kept copy serves every visit.
  const key = url.pathname
  const network = fetch(request).then(async (response) => {
    if (response.ok && response.type === 'basic') await cache.put(key, response.clone())
    return response
  })
  network.catch(() => {})
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS)
  } catch {
    const kept = await cache.match(key, { ignoreVary: true })
    if (kept) return kept
    try {
      return await network
    } catch {
      return offlinePage()
    }
  }
}

async function needsInternet(request) {
  try {
    return await fetch(request)
  } catch {
    return offlinePage()
  }
}

async function offlinePage() {
  const cache = await caches.open(PAGES)
  return (await cache.match(OFFLINE_PAGE)) ?? Response.error()
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

// The app asks for every children's screen to be kept, once per update, after the page has loaded.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'keep-for-offline' || !Array.isArray(event.data.pages)) return
  event.waitUntil(
    keepForOffline(event.data.pages.filter((page) => typeof page === 'string' && isKidPage(page))).then(
      (result) => event.source?.postMessage({ type: 'kept-for-offline', ...result }),
      (error) => event.source?.postMessage({ type: 'keep-for-offline-failed', message: String(error) }),
    ),
  )
})

async function keepForOffline(pages) {
  const pagesCache = await caches.open(PAGES)
  const filesCache = await caches.open(FILES)
  const files = new Set()
  let failed = 0

  // (Each count is awaited first: `failed += await …` would read `failed` before the tasks add to it.)
  const pageErrors = await inBatches(pages, 4, async (page) => {
    const response = await fetch(page, { credentials: 'same-origin' })
    if (!response.ok || response.type !== 'basic') {
      failed += 1
      return
    }
    for (const file of findBuildFiles(await response.clone().text())) files.add(file)
    await pagesCache.put(page, response)
  })
  failed += pageErrors

  // Build files name the files they load later (each picture's outline, fonts in the styles), so
  // follow them until nothing new turns up.
  const queue = [...files]
  const fileErrors = await inBatches(queue, 6, async (file) => {
    let response = await filesCache.match(file)
    if (!response) {
      response = await fetch(file)
      // Build files sometimes name paths that don't exist; there's nothing to keep for those.
      if (!response.ok) return
      await filesCache.put(file, response.clone())
    }
    if (/\.(js|css)$/.test(file)) {
      for (const next of findBuildFiles(await response.text())) {
        if (!files.has(next)) {
          files.add(next)
          queue.push(next)
        }
      }
    }
  })
  failed += fileErrors

  // Only after a complete pass, drop what earlier app versions kept, so storage doesn't grow with
  // each update. A pass cut short (the connection dropped) keeps everything.
  if (failed === 0) {
    const keepPages = new Set([...pages, OFFLINE_PAGE])
    for (const request of await pagesCache.keys()) {
      if (!keepPages.has(new URL(request.url).pathname)) await pagesCache.delete(request)
    }
    for (const request of await filesCache.keys()) {
      if (!files.has(new URL(request.url).pathname)) await filesCache.delete(request)
    }
  }
  return { pages: pages.length, files: files.size, failed }
}

/**
 * Runs `task` over `items` (which may grow while running), at most `size` at a time. One failure
 * doesn't stop the rest; returns how many failed.
 */
async function inBatches(items, size, task) {
  let next = 0
  let failures = 0
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]
      try {
        await task(item)
      } catch {
        failures += 1
      }
    }
  }
  await Promise.all(Array.from({ length: size }, worker))
  return failures
}
