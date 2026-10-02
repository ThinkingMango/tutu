import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { offlinePages } from '@/lib/offline/pages'

const ROOT = join(__dirname, '..', '..')
const SOURCE = readFileSync(join(ROOT, 'public/sw.js'), 'utf8')
const ORIGIN = 'https://mandala.example'

/** Caches keyed by pathname, like the real Cache API used with path keys. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>()
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)!
    const path = (key: string | Request) => new URL(typeof key === 'string' ? key : key.url, ORIGIN).pathname
    return {
      match: async (key: string | Request) => store.get(path(key))?.clone(),
      put: async (key: string | Request, response: Response) => void store.set(path(key), response),
      add: async (key: string) => void store.set(path(key), new Response('offline page')),
      delete: async (key: string | Request) => store.delete(path(key)),
      keys: async () => [...store.keys()].map((p) => new Request(ORIGIN + p)),
    }
  }
  return { stores, api: { open, keys: async () => [...stores.keys()], delete: async (n: string) => stores.delete(n) } }
}

/** Loads public/sw.js as the browser would, with a fake internet (`files`) and fake storage. */
function loadServiceWorker(files: Record<string, string>, { offline = new Set<string>() } = {}) {
  const caches = fakeCaches()
  // Same-origin responses in a browser are `basic`; Node's are `default`.
  class SiteResponse extends Response {
    get type() {
      return 'basic' as const
    }
  }
  const fetch = async (input: string | Request) => {
    const path = new URL(typeof input === 'string' ? input : input.url, ORIGIN).pathname
    if (offline.has(path)) throw new TypeError('Failed to fetch')
    if (!(path in files)) return new SiteResponse('missing', { status: 404 })
    return new SiteResponse(files[path], { status: 200 })
  }
  const context = {
    self: { addEventListener() {}, location: { origin: ORIGIN } },
    caches: caches.api,
    fetch,
    URL,
    Response,
    Request,
    setTimeout,
    clearTimeout,
  }
  runInNewContext(SOURCE, context)
  return { sw: context as unknown as ServiceWorker, stores: caches.stores }
}

/** The parts of public/sw.js these tests call. */
type ServiceWorker = {
  isKidPage: (pathname: string) => boolean
  keepForOffline: (pages: string[]) => Promise<{ pages: number; files: number; failed: number }>
}

const SITE = {
  '/': '<script src="/_next/static/chunks/app.js"></script><link href="/_next/static/chunks/app.css">',
  '/packs/ocean-friends': '<script src="/_next/static/chunks/app.js"></script>',
  '/_next/static/chunks/app.js': 'load("static/chunks/outline-fish.js"); load("static/chunks/does-not-exist.js")',
  '/_next/static/chunks/outline-fish.js': '{"regions":[]}',
  '/_next/static/chunks/app.css': '@font-face{src:url(/_next/static/media/nunito.woff2)}',
  '/_next/static/media/nunito.woff2': 'font',
}

const kept = (stores: Map<string, Map<string, Response>>, prefix: string) =>
  [...stores.entries()].filter(([name]) => name.startsWith(prefix)).flatMap(([, store]) => [...store.keys()]).sort()

describe('offline helper (public/sw.js)', () => {
  it('only keeps children’s screens; the grown-up area, sign-in and the API always need the internet', () => {
    const { sw } = loadServiceWorker({})
    for (const page of ['/', '/garden', '/packs/ocean-friends', '/color/sunny']) expect(sw.isKidPage(page), page).toBe(true)
    for (const page of ['/parent', '/parent/billing', '/auth/callback', '/api/account', '/privacy']) {
      expect(sw.isKidPage(page), page).toBe(false)
    }
  })

  it('is offered every children’s screen and nothing else', () => {
    const { sw } = loadServiceWorker({})
    const pages = offlinePages()
    expect(pages).toContain('/')
    expect(pages).toContain('/garden')
    expect(pages).toContain('/packs/ocean-friends')
    expect(pages).toContain('/color/sunny')
    expect(pages.length).toBeGreaterThan(150)
    for (const page of pages) expect(sw.isKidPage(page), page).toBe(true)
  })

  it('keeps each page and every build file it leads to, such as picture outlines and fonts', async () => {
    const { sw, stores } = loadServiceWorker(SITE)
    const result = await sw.keepForOffline(['/', '/packs/ocean-friends'])
    expect(result).toEqual({ pages: 2, files: 5, failed: 0 })
    expect(kept(stores, 'lm-pages')).toEqual(['/', '/packs/ocean-friends'])
    expect(kept(stores, 'lm-files')).toEqual([
      '/_next/static/chunks/app.css',
      '/_next/static/chunks/app.js',
      '/_next/static/chunks/outline-fish.js',
      '/_next/static/media/nunito.woff2',
    ])
  })

  it('drops files from an earlier update only after a complete pass', async () => {
    const { sw, stores } = loadServiceWorker(SITE)
    await sw.keepForOffline(['/'])
    const files = [...stores.entries()].find(([name]) => name.startsWith('lm-files'))![1]
    files.set('/_next/static/chunks/old-update.js', new Response('old'))
    await sw.keepForOffline(['/'])
    expect(files.has('/_next/static/chunks/old-update.js')).toBe(false)
  })

  it('keeps everything it already had when the connection drops part way through', async () => {
    const first = loadServiceWorker(SITE)
    await first.sw.keepForOffline(['/'])
    const files = [...first.stores.entries()].find(([name]) => name.startsWith('lm-files'))![1]
    files.set('/_next/static/chunks/old-update.js', new Response('old'))
    files.delete('/_next/static/chunks/outline-fish.js')

    // Same storage, but the outline can't be fetched now.
    const dropped = loadServiceWorker(SITE, { offline: new Set(['/_next/static/chunks/outline-fish.js']) })
    dropped.stores.clear()
    for (const [name, store] of first.stores) dropped.stores.set(name, store)
    const result = await dropped.sw.keepForOffline(['/'])

    expect(result.failed).toBeGreaterThan(0)
    expect(files.has('/_next/static/chunks/old-update.js')).toBe(true)
  })

  it('keeps everything it already had when a page fails to load', async () => {
    const { sw, stores } = loadServiceWorker(SITE)
    await sw.keepForOffline(['/'])
    const files = [...stores.entries()].find(([name]) => name.startsWith('lm-files'))![1]
    files.set('/_next/static/chunks/old-update.js', new Response('old'))

    const result = await sw.keepForOffline(['/', '/packs/not-built-yet'])

    expect(result.failed).toBe(1)
    expect(files.has('/_next/static/chunks/old-update.js')).toBe(true)
  })

  it('never contacts another site', () => {
    expect(SOURCE).not.toMatch(/https?:\/\//)
  })
})
