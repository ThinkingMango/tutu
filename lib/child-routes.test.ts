import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { grownUpEventsOnly, isGrownUpPath } from '@/lib/audience-routes'

const ROOT = resolve(__dirname, '..')
const KID_ROUTES = join(ROOT, 'app/(kid)')
const EXTENSIONS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
const IMPORT = /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^import\s+['"]([^'"]+)['"]/gm

const TRACKER_PACKAGES = [
  /^@vercel\/analytics/,
  /^@vercel\/speed-insights/,
  /^posthog/,
  /^@segment\//,
  /^mixpanel/,
  /^react-ga/,
  /^@amplitude\//,
  /^@hotjar\//,
  /^react-facebook-pixel/,
]
const GROWN_UP_MODULES = ['components/grown-up-analytics', 'components/info/', 'components/parent/pictures/', 'lib/legal']
const TRACKER_SNIPPETS = /googletagmanager|google-analytics|gtag\(|fbq\(|connect\.facebook|hotjar|clarity\.ms|plausible|segment\.com/i
const EXTERNAL_LINK = /href=\{?\s*['"`](?:https?:|mailto:|tel:|sms:|\/\/)|target=['"{]_blank|window\.open\(/
const URL_LITERAL = /https?:\/\/[^\s'"`)]+/g
const ALLOWED_URLS = [/^http:\/\/www\.w3\.org\//]

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function resolveLocal(from: string, specifier: string) {
  const base = specifier.startsWith('@/') ? join(ROOT, specifier.slice(2)) : resolve(dirname(from), specifier)
  for (const ext of EXTENSIONS) {
    const candidate = base + ext
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/** Every source file a child can load: the root layout, the kid layouts and pages, and everything they import. */
function childModuleGraph() {
  const entries = [
    join(ROOT, 'app/layout.tsx'),
    ...walk(KID_ROUTES).filter((f) => /\/(page|layout|loading|error|not-found|template)\.tsx?$/.test(f)),
  ]
  const files = new Set<string>()
  const packages = new Set<string>()
  const queue = [...entries]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (files.has(file)) continue
    files.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(IMPORT)) {
      const specifier = match[1] ?? match[2] ?? match[3]
      if (!specifier || specifier.endsWith('.css')) continue
      if (specifier.startsWith('.') || specifier.startsWith('@/')) {
        const target = resolveLocal(file, specifier)
        if (target && /\.tsx?$/.test(target) && !/\.test\.tsx?$/.test(target)) queue.push(target)
      } else {
        packages.add(specifier)
      }
    }
  }
  return { entries, files: [...files], packages: [...packages] }
}

describe('children’s screens', () => {
  const graph = childModuleGraph()
  const rel = (file: string) => relative(ROOT, file)

  it('finds the kid routes and what they load', () => {
    expect(graph.entries.length).toBeGreaterThanOrEqual(5)
    expect(graph.files.map(rel)).toContain('components/coloring/coloring-screen.tsx')
  })

  it('load no analytics or marketing packages', () => {
    const trackers = graph.packages.filter((name) => TRACKER_PACKAGES.some((pattern) => pattern.test(name)))
    expect(trackers).toEqual([])
  })

  it('never import grown-up-only modules', () => {
    const leaks = graph.files.map(rel).filter((file) => GROWN_UP_MODULES.some((module) => file.startsWith(module)))
    expect(leaks).toEqual([])
  })

  it('contain no tracking snippets, outside links or new windows', () => {
    const problems = graph.files.flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      const found: string[] = []
      if (TRACKER_SNIPPETS.test(source)) found.push(`${rel(file)}: tracking snippet`)
      if (EXTERNAL_LINK.test(source)) found.push(`${rel(file)}: outside link`)
      for (const [url] of source.matchAll(URL_LITERAL)) {
        if (!ALLOWED_URLS.some((pattern) => pattern.test(url))) found.push(`${rel(file)}: ${url}`)
      }
      return found
    })
    expect(problems).toEqual([])
  })

  it('never link to pricing or checkout', () => {
    const prompts = graph.files.filter((file) => /['"`]\/parent\/billing/.test(readFileSync(file, 'utf8'))).map(rel)
    expect(prompts).toEqual([])
  })
})

describe('grown-up scripts never reach children’s screens', () => {
  const SOURCE_DIRS = ['app', 'components', 'lib', 'hooks'].map((dir) => join(ROOT, dir))
  const sources = SOURCE_DIRS.flatMap(walk).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  const GROWN_UP_DIRS = ['app/parent/', 'app/(info)/', 'components/parent/', 'components/info/']
  // A client-side <Link> to a children's screen would carry Stripe.js and analytics along with it.
  const LINK_TO_KIDS = /<Link\b[^>]*?href=\{?\s*(?:["'`]\/(?:["'`?#]|garden\b|packs\/|color\/)|packHref\()/

  it('load Stripe.js only when a checkout opens', () => {
    const eager = sources
      .filter((file) =>
        [...readFileSync(file, 'utf8').matchAll(/\bimport\s+(type\s)?[^'"]*?from\s*['"]([^'"]+)['"]/g)].some(
          // Type-only imports are removed from the build, so they can't load anything.
          ([, typeOnly, specifier]) => specifier === '@stripe/stripe-js' && !typeOnly,
        ),
      )
      .map((file) => relative(ROOT, file))
    expect(eager).toEqual([])
  })

  it('leave the grown-up area with a full page load', () => {
    const clientLinks = sources
      .filter((file) => GROWN_UP_DIRS.some((dir) => relative(ROOT, file).startsWith(dir)))
      .filter((file) => LINK_TO_KIDS.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file))
    expect(clientLinks).toEqual([])
  })

  it('reload any page that grown-up scripts have touched before a child sees it', () => {
    expect(readFileSync(join(KID_ROUTES, 'layout.tsx'), 'utf8')).toMatch(/<GrownUpScriptGuard>/)
    expect(readFileSync(join(ROOT, 'components/grown-up-analytics.tsx'), 'utf8')).toMatch(/markGrownUpDocument/)
  })
})

describe('visit statistics', () => {
  it('count only grown-up pages', () => {
    for (const path of ['/parent/home', '/parent/pictures', '/parent/billing', '/privacy', '/refunds', '/support']) {
      expect(isGrownUpPath(path), path).toBe(true)
    }
    for (const path of ['/', '/garden', '/packs/ocean-friends', '/color/star-bloom', '/parent', '/parentx', '/privacyx']) {
      expect(isGrownUpPath(path), path).toBe(false)
    }
  })

  it('drop events from children’s screens even if the script is already loaded', () => {
    const event = (url: string) => ({ type: 'pageview' as const, url })
    expect(grownUpEventsOnly(event('https://mandala.smartmango.ai/parent/home'))).not.toBeNull()
    expect(grownUpEventsOnly(event('https://mandala.smartmango.ai/garden'))).toBeNull()
    expect(grownUpEventsOnly(event('https://mandala.smartmango.ai/parent?x=1'))).toBeNull()
    expect(grownUpEventsOnly(event('not a url'))).toBeNull()
  })

  it('are not mounted by the root layout', () => {
    expect(readFileSync(join(ROOT, 'app/layout.tsx'), 'utf8')).not.toMatch(/Analytics/)
  })
})
