// Reads and writes a picture pack's files, checks each step of adding it, and renders the app's pack
// registry. Shared by `pnpm packs`, `pnpm trace-pack` and the tests, so all three agree on the rules.
//
//   art/<pack>/pages.json        the pack: name, description, icon, status, image style and page list
//   art/<pack>/source/<page>.png the picture for each page
//   art/<pack>/labels.json       a spoken name for every numbered area on every page
//   lib/templates/<pack>/*.json  traced pages, written by `pnpm packs trace`
//   lib/templates/registry.generated.ts  every pack's traced pages, written by `pnpm packs sync`

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PACK_ICON_NAMES } from '../../lib/pack-icons.ts'
import { AUDIENCES, type Audience } from '../trace-pack/segment.ts'

export type PackStatus = 'draft' | 'published'

export type ManifestPage = { id: string; name: string; subject: string; minArea?: number }

export type PackManifest = {
  pack: string
  name: string
  description: string
  icon: string
  /** Shelf position after Standard, lowest first. */
  order: number
  status: PackStatus
  /** Who colors it, which sets the art rules. Children when left out. */
  audience?: Audience
  generator: string
  /** The drawing style every page's image prompt starts with. */
  style: string
  pages: ManifestPage[]
}

/** Names for one page's areas, keyed by the area number shown on its label sheet. */
export type LabelEntry = { image: string; areas: Record<string, string> }
export type LabelFile = Record<string, LabelEntry>

export type TracedFile = {
  pack: string
  id: string
  name: string
  source: { file: string; sha256: string }
  /** Written only for fine-line pages; bold is the default. */
  line?: 'fine'
  regions: { id: string; label: string; d: string }[]
  details: { kind: string; d: string }[]
  review: { ok: boolean; problems: string[]; placeholderLabels: number; absorbedSpecks: number; backgroundShare: number }
}

export const PACK_ID = /^[a-z]+(-[a-z]+)*$/
export const RESERVED_PACK_IDS = ['standard']
export const REGISTRY_FILE = 'lib/templates/registry.generated.ts'
export const REVIEW_DIR = '.pack-review'

export const DEFAULT_STYLE =
  "Children's coloring book page, square 1:1. Pure white background with a wide empty white margin on all sides; nothing touches the edges. Bold uniform thick black outlines, same weight everywhere. No shading, no grey, no texture, no hatching, no black fills except tiny eye dots, no text, no border frame. Every shape fully closed. One large friendly subject, centered, with a very simple setting. About 16 large closed areas to color. Eyes are small solid black dots, smile is one short line. Very simple, cute, for a 3-year-old."

export const GROWN_UP_STYLE =
  'Adult coloring book page, square 1:1. Pure white background with a clear empty white margin on all sides; the design never touches the edges. One large circular mandala, centered, perfectly radially symmetric, filling about 90% of the page. Crisp black line art drawn with one medium line weight everywhere, never hairline. Every shape is fully closed so it can be filled. Intricate but clean: many concentric rings of petals, leaves and bands, with no shape smaller than about 2% of the page width. No shading, no grey, no stippling, no dots, no hatching, no solid black fills, no text, no border frame, nothing outside the mandala.'

export const paths = {
  manifest: (root: string, pack: string) => join(root, 'art', pack, 'pages.json'),
  labels: (root: string, pack: string) => join(root, 'art', pack, 'labels.json'),
  sourceDir: (pack: string) => join('art', pack, 'source'),
  /** Relative to the project root, as recorded in traced files. */
  source: (pack: string, page: string) => join('art', pack, 'source', `${page}.png`),
  traced: (root: string, pack: string, page: string) => join(root, 'lib', 'templates', pack, `${page}.json`),
  review: (root: string, pack: string) => join(root, REVIEW_DIR, pack),
}

export const imageKey = (sha256: string) => sha256.slice(0, 12)
export const placeholderLabel = (pageName: string, area: number) => `${pageName} 区域 ${area}`
export const isPlaceholder = (label: string) => label.trim() === '' || / (区域|area) \d+$/.test(label)
export const promptFor = (manifest: PackManifest, page: ManifestPage) => `${manifest.style} Subject: ${page.subject}.`

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T

export function sha256Of(file: string) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

export function listPackIds(root: string) {
  return readdirSync(join(root, 'art'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(paths.manifest(root, entry.name)))
    .map((entry) => entry.name)
}

export function readManifest(root: string, pack: string) {
  return readJson<PackManifest>(paths.manifest(root, pack))
}

/** Every pack in shelf order. */
export function readManifests(root: string) {
  return listPackIds(root)
    .map((pack) => readManifest(root, pack))
    .sort((a, b) => a.order - b.order || a.pack.localeCompare(b.pack))
}

/** Pages stay one per line so the page list reads like a table and diffs stay small. */
export function writeManifest(root: string, manifest: PackManifest) {
  const { pages, ...pack } = manifest
  const head = JSON.stringify(pack, null, 2).replace(/\n}$/, '')
  const line = (page: ManifestPage) =>
    `    { ${Object.entries(page).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(', ')} }`
  const list = pages.length ? `[\n${pages.map(line).join(',\n')}\n  ]` : '[]'
  writeFileSync(paths.manifest(root, manifest.pack), `${head},\n  "pages": ${list}\n}\n`)
}

export function readLabels(root: string, pack: string): LabelFile {
  const file = paths.labels(root, pack)
  return existsSync(file) ? readJson<LabelFile>(file) : {}
}

export function writeLabels(root: string, pack: string, labels: LabelFile) {
  writeFileSync(paths.labels(root, pack), `${JSON.stringify(labels, null, 2)}\n`)
}

export function readTraced(root: string, pack: string, page: string): TracedFile | null {
  const file = paths.traced(root, pack, page)
  return existsSync(file) ? readJson<TracedFile>(file) : null
}

export function writeTraced(root: string, traced: TracedFile) {
  writeFileSync(paths.traced(root, traced.pack, traced.id), `${JSON.stringify(traced, null, 2)}\n`)
}

/** The labels.json names for a traced page, if they were written for this exact picture and area count. */
export function labelsFor(entry: LabelEntry | undefined, sha256: string, areaCount: number) {
  if (!entry || entry.image !== imageKey(sha256)) return null
  const names = Array.from({ length: areaCount }, (_, i) => entry.areas[String(i + 1)])
  return names.every((name) => typeof name === 'string') && Object.keys(entry.areas).length === areaCount ? names : null
}

type Box = { minX: number; minY: number; maxX: number; maxY: number }

function boxOf(d: string): Box | null {
  const numbers = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  if (numbers.length < 2) return null
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    box.minX = Math.min(box.minX, numbers[i])
    box.maxX = Math.max(box.maxX, numbers[i])
    box.minY = Math.min(box.minY, numbers[i + 1])
    box.maxY = Math.max(box.maxY, numbers[i + 1])
  }
  return box
}

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth']

/**
 * Spoken names for a radial page's areas, from where each one sits: the rings around the middle, then
 * every other area by its band and clock position, such as "Middle ring, 3 o'clock". Repeats get a number.
 */
export function positionalNames(regions: readonly { d: string }[], page = 1000): string[] {
  const c = page / 2
  const boxes = regions.map((r) => boxOf(r.d))
  const surrounds = (b: Box | null) => Boolean(b && b.minX < c && b.maxX > c && b.minY < c && b.maxY > c)

  const rings = boxes
    .map((b, index) => ({ index, extent: b ? Math.max(b.maxX - b.minX, b.maxY - b.minY) : 0 }))
    .filter(({ index }) => surrounds(boxes[index]))
    .sort((a, b) => a.extent - b.extent)
  const names: string[] = new Array(regions.length)
  rings.forEach(({ index }, order) => {
    names[index] = order === 0 ? 'Centre' : `${ORDINALS[order - 1] ?? `Ring ${order}`} ring around the centre`
  })

  for (let i = 0; i < regions.length; i++) {
    if (names[i]) continue
    const b = boxes[i]
    if (!b) {
      names[i] = 'Small shape'
      continue
    }
    const x = (b.minX + b.maxX) / 2 - c
    const y = (b.minY + b.maxY) / 2 - c
    const r = Math.hypot(x, y) / c
    const band = r < 0.34 ? 'Inner ring' : r < 0.62 ? 'Middle ring' : r < 0.92 ? 'Outer ring' : 'Edge'
    const hour = Math.round(((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360 / 30) % 12 || 12
    names[i] = `${band}, ${hour} o'clock`
  }

  const seen = new Map<string, number>()
  const totals = new Map<string, number>()
  for (const name of names) totals.set(name, (totals.get(name) ?? 0) + 1)
  return names.map((name) => {
    if (totals.get(name) === 1) return name
    const n = (seen.get(name) ?? 0) + 1
    seen.set(name, n)
    return `${name}, piece ${n}`
  })
}

export type PageReport = {
  id: string
  name: string
  hasSource: boolean
  traced: boolean
  /** The picture changed after it was traced. */
  stale: boolean
  problems: string[]
  areas: number
  placeholders: number
  labelsSaved: boolean
}

export type Step = { title: string; done: boolean; detail: string; next: string }

export type PackReport = { manifest: PackManifest; planProblems: string[]; pages: PageReport[]; steps: Step[]; ready: boolean }

function planProblems(manifest: PackManifest, folder: string, others: PackManifest[]) {
  const problems: string[] = []
  if (manifest.pack !== folder) problems.push(`"pack" is "${manifest.pack}" but the folder is art/${folder}`)
  if (!PACK_ID.test(folder)) problems.push('the pack id must be lowercase words joined by dashes')
  if (RESERVED_PACK_IDS.includes(folder)) problems.push(`"${folder}" is reserved`)
  if (!manifest.name?.trim()) problems.push('write the pack "name"')
  if (!manifest.description?.trim()) problems.push('write the pack "description" parents will read')
  if (!(PACK_ICON_NAMES as readonly string[]).includes(manifest.icon)) {
    problems.push(`"icon" must be one of the names in lib/pack-icons.ts (pnpm packs icons)`)
  }
  if (!Number.isFinite(manifest.order)) problems.push('"order" must be a number')
  if (!['draft', 'published'].includes(manifest.status)) problems.push('"status" must be "draft" or "published"')
  if (manifest.audience !== undefined && !AUDIENCES.includes(manifest.audience)) {
    problems.push(`"audience" must be one of: ${AUDIENCES.join(', ')}`)
  }
  if (!manifest.style?.trim()) problems.push('write the image "style"')
  if (!manifest.generator?.trim()) problems.push('record in "generator" how the pictures were made')
  if (!manifest.pages?.length) problems.push('add at least one page to "pages"')

  const takenElsewhere = new Set(others.flatMap((m) => m.pages.map((p) => p.id)))
  const seen = new Set<string>()
  for (const page of manifest.pages ?? []) {
    const label = page.id || '(page without an id)'
    if (!PACK_ID.test(page.id ?? '')) problems.push(`${label}: page ids must be lowercase words joined by dashes`)
    if (seen.has(page.id)) problems.push(`${label}: listed twice`)
    if (takenElsewhere.has(page.id)) problems.push(`${label}: another pack already uses this page id`)
    if (!page.name?.trim()) problems.push(`${label}: write its "name"`)
    if (!page.subject?.trim()) problems.push(`${label}: describe its "subject" for the image prompt`)
    seen.add(page.id)
  }
  return problems
}

function inspectPage(root: string, pack: string, page: ManifestPage, labels: LabelFile): PageReport {
  const sourceFile = join(root, paths.source(pack, page.id))
  const hasSource = existsSync(sourceFile)
  const traced = readTraced(root, pack, page.id)
  const report: PageReport = {
    id: page.id,
    name: page.name,
    hasSource,
    traced: Boolean(traced),
    stale: false,
    problems: [],
    areas: traced?.regions.length ?? 0,
    placeholders: 0,
    labelsSaved: false,
  }
  if (!traced) return report

  report.stale = hasSource && sha256Of(sourceFile) !== traced.source.sha256
  report.problems = traced.review.ok ? [] : traced.review.problems
  report.placeholders = traced.regions.filter((r) => isPlaceholder(r.label)).length
  const saved = labelsFor(labels[page.id], traced.source.sha256, traced.regions.length)
  report.labelsSaved = Boolean(saved && saved.every((name, i) => name === traced.regions[i].label))
  return report
}

const list = (ids: string[], max = 6) => (ids.length > max ? `${ids.slice(0, max).join(', ')} and ${ids.length - max} more` : ids.join(', '))

/** What's done for a pack, what isn't, and the command for the next step. */
export function inspectPack(root: string, manifest: PackManifest, all: PackManifest[]): PackReport {
  const pack = manifest.pack
  const others = all.filter((m) => m.pack !== pack)
  const problems = planProblems(manifest, pack, others)
  const labels = readLabels(root, pack)
  const pages = (manifest.pages ?? []).filter((p) => p.id).map((p) => inspectPage(root, pack, p, labels))

  const missing = pages.filter((p) => !p.hasSource).map((p) => p.id)
  const untraced = pages.filter((p) => p.hasSource && (!p.traced || p.stale)).map((p) => p.id)
  const failing = pages.filter((p) => p.traced && !p.stale && p.problems.length)
  const unnamed = pages.filter((p) => p.traced && (p.placeholders > 0 || !p.labelsSaved))
  const total = pages.length
  const tracedCount = pages.filter((p) => p.traced).length
  const waiting = (what: string) => `Waiting for ${what}`

  const steps: Step[] = [
    {
      title: 'Plan the pack',
      done: problems.length === 0,
      detail: problems.length ? problems.join('\n') : `${total} pages planned in art/${pack}/pages.json`,
      next: `Edit art/${pack}/pages.json`,
    },
    {
      title: 'Draw the pictures',
      done: total > 0 && missing.length === 0,
      detail:
        total === 0
          ? waiting('the page list')
          : missing.length
            ? `${total - missing.length} of ${total} saved in ${paths.sourceDir(pack)}. Missing: ${list(missing)}`
            : `${total} of ${total} saved in ${paths.sourceDir(pack)}`,
      next: `pnpm packs prompts ${pack}`,
    },
    {
      title: 'Trace them into areas',
      done: total > 0 && missing.length === 0 && untraced.length === 0 && failing.length === 0,
      detail:
        [
          untraced.length ? `Not traced yet, or the picture changed: ${list(untraced)}` : '',
          ...failing.map((p) => `${p.id} breaks the art rules: ${p.problems.join('; ')}`),
        ]
          .filter(Boolean)
          .join('\n') ||
        (tracedCount ? `${tracedCount} of ${total} pages traced and within the art rules` : waiting('the pictures')),
      next: untraced.length
        ? `pnpm packs trace ${pack} ${untraced.join(' ')}`
        : `Redraw ${list(failing.map((p) => p.id))}, or set a larger "minArea" on the page, then pnpm packs trace ${pack} ${failing.map((p) => p.id).join(' ')}`,
    },
    {
      title: 'Name every area',
      done: total > 0 && pages.every((p) => p.traced && p.placeholders === 0 && p.labelsSaved),
      detail: unnamed.length
        ? `Still to name: ${list(unnamed.map((p) => `${p.id} (${p.placeholders ? `${p.placeholders} areas` : 'not saved in labels.json'})`))}`
        : total > 0 && tracedCount === total
          ? `Every area on every page has a spoken name in art/${pack}/labels.json`
          : waiting('every page to be traced'),
      next: `pnpm packs sheet ${pack}, write the names in art/${pack}/labels.json, then pnpm packs labels ${pack}`,
    },
  ]
  const ready = steps.every((s) => s.done)
  steps.push({
    title: 'Publish',
    done: manifest.status === 'published',
    detail: manifest.status === 'published' ? 'Live for everyone' : 'Draft: shows in development and the v0 preview only',
    next: `pnpm packs publish ${pack}`,
  })
  return { manifest, planProblems: problems, pages, steps, ready }
}

const quote = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/**
 * The app's pack registry: every pack and its traced pages, in shelf order. Each page lists its
 * areas and spoken names, and imports its outline only when it's drawn, so the app never ships
 * every page's outline to every screen.
 */
export function renderRegistry(root: string) {
  const entries = readManifests(root).map((manifest) => {
    const pages = manifest.pages.flatMap((page) => {
      const traced = readTraced(root, manifest.pack, page.id)
      if (!traced) return []
      return [
        [
          '      {',
          `        id: ${quote(page.id)},`,
          `        name: ${quote(traced.name)},`,
          ...(traced.line === 'fine' ? [`        line: 'fine',`] : []),
          '        regions: [',
          ...traced.regions.map((region) => `          [${quote(region.id)}, ${quote(region.label)}],`),
          '        ],',
          `        outline: () => import('@/lib/templates/${manifest.pack}/${page.id}.json'),`,
          '      },',
        ].join('\n'),
      ]
    })
    const list = `[\n${pages.join('\n')}\n    ]`
    const listed = !pages.length
      ? '[]'
      : manifest.status === 'draft'
        ? `DRAFTS_LISTED\n      ? ${list.replace(/\n/g, '\n  ')}\n      : []`
        : list
    return [
      '  {',
      `    id: ${quote(manifest.pack)},`,
      `    name: ${quote(manifest.name)},`,
      `    description: ${quote(manifest.description)},`,
      `    icon: ${quote(manifest.icon)},`,
      `    status: ${quote(manifest.status)},`,
      ...(manifest.audience === 'grown-ups' ? [`    audience: 'grown-ups',`] : []),
      `    pages: ${listed},`,
      '  },',
    ].join('\n')
  })

  return [
    '// Generated by `pnpm packs sync` from art/*/pages.json. Do not edit by hand.',
    '// Each page imports its outline only when it is drawn. Draft pages are only referenced in',
    '// development, so production bundles leave their art out.',
    "import type { TracedPackSource } from '@/lib/templates/traced'",
    '',
    "const DRAFTS_LISTED = process.env.NODE_ENV === 'development'",
    '',
    'export const TRACED_PACK_SOURCES = [',
    ...entries,
    '] as const satisfies readonly TracedPackSource[]',
    '',
  ].join('\n')
}

/** Rewrites the registry if it changed. Returns whether it did. */
export function writeRegistry(root: string) {
  const file = join(root, REGISTRY_FILE)
  const next = renderRegistry(root)
  if (existsSync(file) && readFileSync(file, 'utf8') === next) return false
  writeFileSync(file, next)
  return true
}
