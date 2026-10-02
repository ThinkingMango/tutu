#!/usr/bin/env node
// Converts a pack's chosen source images into tap-to-fill drawings. Usually run as `pnpm packs trace`.
//
//   pnpm trace-pack ocean-friends            trace every page that has a source image
//   pnpm trace-pack ocean-friends seal-pup   trace one page
//   --min-area=0.004                         smallest tap area, as a share of the canvas
//                                            (about 63×63 units; the 40-unit width check still applies).
//                                            A page's "minArea" in pages.json sets its own default.
//                                            Grown-up packs ("audience": "grown-ups") use finer rules.
//
// Reads  art/<pack>/pages.json, art/<pack>/source/<id>.png and art/<pack>/labels.json
// Writes lib/templates/<pack>/<id>.json, review sheets in .pack-review/<pack>/<id>.png, and the registry
// Exits non-zero when a page is missing or breaks the art rules, so it can gate a release.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Potrace } from 'potrace'
import sharp from 'sharp'
import { labelsFor, paths, placeholderLabel, readLabels, writeRegistry } from './pack/pack-files.ts'
import { checkPage, rulesFor, segment } from './trace-pack/segment.ts'

const SIZE = 1000
const INK = '#2b2b2b'
const PREVIEW_FILLS = ['#f28b82', '#fbbc04', '#fff475', '#ccff90', '#a7ffeb', '#aecbfa', '#d7aefb', '#fdcfe8']

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')))
const [pack, ...only] = args.filter((a) => !a.startsWith('--'))
if (!pack) {
  console.error('Usage: pnpm trace-pack <pack> [page-id...] [--min-area=0.004]')
  process.exit(2)
}

const manifest = JSON.parse(readFileSync(join(root, 'art', pack, 'pages.json'), 'utf8'))
const pages = only.length ? manifest.pages.filter((p) => only.includes(p.id)) : manifest.pages
const unknown = only.filter((id) => !manifest.pages.some((p) => p.id === id))
if (unknown.length) {
  console.error(`Unknown page id(s): ${unknown.join(', ')}`)
  process.exit(2)
}

const outDir = join(root, 'lib', 'templates', pack)
const reviewDir = paths.review(root, pack)
const savedLabels = readLabels(root, pack)
mkdirSync(outDir, { recursive: true })
mkdirSync(reviewDir, { recursive: true })

const rules = rulesFor(manifest.audience)
const options = {
  inkThreshold: 140,
  minAreaShare: Number(flags['min-area'] ?? rules.minAreaShare),
  ...(rules.absorbThin && { absorbThinnerThan: rules.minThickness }),
  ...(rules.keepLines && { keepInkFartherThan: 4 }),
}
const outline = rules.line === 'fine' ? 6 : 14
let failures = 0

for (const page of pages) {
  const sourceFile = join('art', pack, 'source', `${page.id}.png`)
  if (!existsSync(join(root, sourceFile))) {
    console.log(`MISSING  ${page.id}  (no ${sourceFile})`)
    failures++
    continue
  }
  const source = readFileSync(join(root, sourceFile))
  const sha256 = createHash('sha256').update(source).digest('hex')
  const gray = await sharp(source)
    .flatten({ background: '#ffffff' })
    .resize(SIZE, SIZE, { fit: 'contain', background: '#ffffff' })
    .grayscale()
    .raw()
    .toBuffer()

  const pageOptions = page.minArea && !flags['min-area'] ? { ...options, minAreaShare: page.minArea } : options
  const result = segment(new Uint8Array(gray), SIZE, SIZE, pageOptions)
  const review = checkPage(result, 1, rules)

  const outFile = join(outDir, `${page.id}.json`)
  const names = labelsFor(savedLabels[page.id], sha256, result.regions.length)

  const regions = []
  for (let index = 0; index < result.regions.length; index++) {
    const id = `area-${String(index + 1).padStart(2, '0')}`
    const d = await traceMask((p) => result.labels[p] === index)
    const label = names?.[index]?.trim() || placeholderLabel(page.name, index + 1)
    regions.push({ id, label, d })
  }
  const detailPath = result.detailMask.some(Boolean) ? await traceMask((p) => result.detailMask[p] === 1) : ''
  const details = detailPath ? [{ kind: 'dot', d: detailPath }] : []

  const placeholders = regions.filter((r) => r.label.startsWith(`${page.name} area `)).length
  const drawing = {
    pack,
    id: page.id,
    name: page.name,
    source: { file: sourceFile, sha256 },
    ...(rules.line === 'fine' && { line: 'fine' }),
    regions,
    details,
    review: {
      ok: review.ok,
      problems: review.problems,
      placeholderLabels: placeholders,
      absorbedSpecks: result.absorbed,
      backgroundShare: Number(result.backgroundShare.toFixed(3)),
    },
  }
  writeFileSync(outFile, `${JSON.stringify(drawing, null, 2)}\n`)
  await writeReviewSheet(page.id, source, drawing)

  if (!review.ok) failures++
  const status = review.ok ? 'OK      ' : 'FAIL    '
  const relabel = savedLabels[page.id] && !names ? 'labels.json was written for an earlier version of this picture' : ''
  const notes = [...review.problems, placeholders ? `${placeholders} areas to name` : '', relabel].filter(Boolean)
  console.log(`${status}${page.id}  ${regions.length} areas, ${details.length ? 'ink details' : 'no details'}${notes.length ? `  — ${notes.join('; ')}` : ''}`)
}

if (writeRegistry(root)) console.log('\nUpdated lib/templates/registry.generated.ts')
console.log(`\nReview sheets: ${relative(root, reviewDir)}/<page>.png (source, colored, blank)`)
process.exit(failures ? 1 : 0)

async function traceMask(inside) {
  const mask = Buffer.alloc(SIZE * SIZE, 255)
  for (let p = 0; p < mask.length; p++) if (inside(p)) mask[p] = 0
  const png = await sharp(mask, { raw: { width: SIZE, height: SIZE, channels: 1 } }).png().toBuffer()
  const tracer = new Potrace({ turdSize: 20, optTolerance: 0.4, threshold: 128, blackOnWhite: true })
  await new Promise((resolve, reject) => tracer.loadImage(png, (error) => (error ? reject(error) : resolve())))
  const d = tracer.getPathTag().match(/ d="([^"]*)"/)?.[1] ?? ''
  const precision = rules.line === 'fine' ? 1 : 10
  return d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * precision) / precision)).trim()
}

async function writeReviewSheet(id, source, drawing) {
  const svg = (filled) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 1048 1048" width="${SIZE}" height="${SIZE}">` +
        `<rect x="-24" y="-24" width="1048" height="1048" fill="#fffdf8"/>` +
        `<g stroke="${INK}" stroke-width="${outline}" stroke-linejoin="round">` +
        drawing.regions
          .map((r, i) => `<path d="${r.d}" fill="${filled ? PREVIEW_FILLS[i % PREVIEW_FILLS.length] : '#ffffff'}"/>`)
          .join('') +
        drawing.details.map((d) => `<path d="${d.d}" fill="${INK}" fill-rule="${outline === 6 ? 'evenodd' : 'nonzero'}" stroke="none"/>`).join('') +
        `</g></svg>`,
    )
  const tile = (input) => sharp(input).flatten({ background: '#ffffff' }).resize(SIZE, SIZE, { fit: 'contain', background: '#ffffff' }).png().toBuffer()
  await sharp({ create: { width: SIZE * 3, height: SIZE, channels: 3, background: '#ffffff' } })
    .composite([
      { input: await tile(source), left: 0, top: 0 },
      { input: await tile(svg(true)), left: SIZE, top: 0 },
      { input: await tile(svg(false)), left: SIZE * 2, top: 0 },
    ])
    .png()
    .toFile(join(reviewDir, `${id}.png`))
}
