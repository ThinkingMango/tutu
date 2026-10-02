#!/usr/bin/env node
// Add a picture pack step by step. Run `pnpm packs` for the steps, or read art/README.md.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { PACK_ICON_NAMES } from '../lib/pack-icons.ts'
import {
  DEFAULT_STYLE,
  GROWN_UP_STYLE,
  PACK_ID,
  RESERVED_PACK_IDS,
  imageKey,
  inspectPack,
  isPlaceholder,
  listPackIds,
  paths,
  placeholderLabel,
  positionalNames,
  promptFor,
  readLabels,
  readManifest,
  readManifests,
  readTraced,
  writeLabels,
  writeManifest,
  writeRegistry,
  writeTraced,
} from './pack/pack-files.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [key, ...value] = a.slice(2).split('=')
      return [key, value.length ? value.join('=') : true]
    }),
)
const [command, packId, ...pageIds] = args.filter((a) => !a.startsWith('--'))

const HELP = `Add a picture pack, one step at a time. Each step tells you the next one.

  1. Plan      pnpm packs new <pack> --name="Farm Friends" --icon=tractor [--audience=grown-ups]
               Creates art/<pack>/pages.json as a draft. Write the description and list the pages.
               Grown-up packs allow 40 to 320 finer areas and draw a thinner outline.
  2. Draw      pnpm packs prompts <pack>
               Prints the image prompt for each page that has no picture yet.
               Save each picture as art/<pack>/source/<page>.png
  3. Trace     pnpm packs trace <pack> [page...]
               Turns the pictures into tap-to-fill areas and checks the art rules.
               Published pages are never retraced unless you pass --replace.
  4. Name      pnpm packs sheet <pack>
               Draws numbered sheets in .pack-review/<pack>/ so you can see every area.
               pnpm packs labels <pack>
               Writes art/<pack>/labels.json with one name per numbered area. Replace each
               placeholder, then run it again to put the names on the pages.
               --by-position names round pages by ring and clock position instead.
  5. Publish   pnpm packs publish <pack>
               Checks every step and makes the pack live. Until then it's a draft, shown only
               in development and the v0 preview.

  pnpm packs status [pack]     what's done and the exact next command
  pnpm packs unpublish <pack>  back to draft
  pnpm packs icons             icons a pack can use
  pnpm packs sync              rebuild lib/templates/registry.generated.ts`

function fail(message) {
  console.error(message)
  process.exit(1)
}

function requirePack() {
  if (!packId) fail(`Name the pack, for example: pnpm packs ${command} farm-friends`)
  if (!listPackIds(root).includes(packId)) {
    fail(`There's no art/${packId}/pages.json. Packs: ${listPackIds(root).join(', ')}. Start one with pnpm packs new ${packId}`)
  }
  return readManifest(root, packId)
}

function report(manifest) {
  return inspectPack(root, manifest, readManifests(root))
}

function printReport(result) {
  const { manifest, steps } = result
  console.log(`\n${manifest.name || manifest.pack} (${manifest.pack}), ${manifest.status}`)
  steps.forEach((step, i) => {
    console.log(`  [${step.done ? 'x' : ' '}] ${i + 1}. ${step.title}`)
    for (const line of step.detail.split('\n')) console.log(`         ${line}`)
  })
  const next = steps.find((s) => !s.done)
  console.log(next ? `\n  Next: ${next.next}` : '\n  Done. The pack is live.')
}

async function create() {
  if (!packId) fail('Usage: pnpm packs new <pack> --name="Farm Friends" [--icon=tractor]')
  if (!PACK_ID.test(packId)) fail('A pack id is lowercase words joined by dashes, like farm-friends')
  if (RESERVED_PACK_IDS.includes(packId)) fail(`"${packId}" is reserved`)
  if (existsSync(paths.manifest(root, packId))) fail(`art/${packId}/pages.json already exists. See pnpm packs status ${packId}`)
  const icon = typeof flags.icon === 'string' ? flags.icon : 'sparkles'
  if (!PACK_ICON_NAMES.includes(icon)) fail(`Unknown icon "${icon}". Choose one of: ${PACK_ICON_NAMES.join(', ')}`)
  const grownUps = flags.audience === 'grown-ups'
  if (flags.audience && !grownUps && flags.audience !== 'children') fail('--audience is children or grown-ups')

  const name =
    typeof flags.name === 'string'
      ? flags.name
      : packId.replace(/(^|-)([a-z])/g, (_, dash, c) => `${dash ? ' ' : ''}${c.toUpperCase()}`)
  mkdirSync(join(root, paths.sourceDir(packId)), { recursive: true })
  writeManifest(root, {
    pack: packId,
    name,
    description: '',
    icon,
    order: Math.max(0, ...readManifests(root).map((m) => m.order)) + 1,
    status: 'draft',
    ...(grownUps && { audience: 'grown-ups' }),
    generator: 'v0 built-in image generation',
    style: grownUps ? GROWN_UP_STYLE : DEFAULT_STYLE,
    pages: [],
  })
  writeRegistry(root)
  console.log(`Created art/${packId}/pages.json as a draft.

Next, open it and:
  - write the "description" parents will read
  - adjust the "style" if this pack needs a different setting
  - list the pages, one per line:
      { "id": "cow-meadow", "name": "Cow Meadow", "subject": "a happy cow in a meadow of daisies" }

Then run pnpm packs status ${packId}`)
}

function prompts() {
  const manifest = requirePack()
  const wanted = pageIds.length
    ? manifest.pages.filter((p) => pageIds.includes(p.id))
    : manifest.pages.filter((p) => flags.all || !existsSync(join(root, paths.source(manifest.pack, p.id))))
  if (!wanted.length) {
    console.log(`Every page already has a picture. Use --all to print every prompt anyway, or run pnpm packs trace ${manifest.pack}`)
    return
  }
  for (const page of wanted) console.log(`${paths.source(manifest.pack, page.id)}\n  ${promptFor(manifest, page)}\n`)
  console.log(`Save each picture as a square PNG at the path above, then run pnpm packs trace ${manifest.pack}`)
}

function trace() {
  const manifest = requirePack()
  if (manifest.status === 'published' && !flags.replace) {
    const targets = pageIds.length ? pageIds : manifest.pages.map((p) => p.id)
    const shipped = targets.filter((id) => readTraced(root, manifest.pack, id))
    if (shipped.length) {
      fail(`${manifest.name} is published, and retracing replaces pages children may already have colored: ${shipped.join(', ')}.
Their saved fills would stop lining up with the new areas. Add a new page instead, or pass --replace if you're sure.`)
    }
  }
  const passThrough = args.filter((a) => a.startsWith('--min-area'))
  const result = spawnSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', join(root, 'scripts', 'trace-pack.mjs'), manifest.pack, ...pageIds, ...passThrough],
    { stdio: 'inherit', cwd: root },
  )
  console.log(`\nLook at each review sheet, then run pnpm packs sheet ${manifest.pack} to name the areas.`)
  process.exitCode = result.status ?? 1
}

function labels() {
  const manifest = requirePack()
  const saved = readLabels(root, manifest.pack)
  const next = {}
  let placeholders = 0

  for (const page of manifest.pages) {
    const traced = readTraced(root, manifest.pack, page.id)
    if (!traced) {
      if (saved[page.id]) next[page.id] = saved[page.id]
      console.log(`SKIP    ${page.id}  not traced yet`)
      continue
    }
    const count = traced.regions.length
    const image = imageKey(traced.source.sha256)
    let entry = saved[page.id]
    if (!entry) {
      entry = { image, areas: Object.fromEntries(traced.regions.map((r, i) => [String(i + 1), r.label])) }
    } else if (entry.image !== image || Object.keys(entry.areas).length !== count) {
      console.log(`RESET   ${page.id}  the picture or its areas changed since these names were written`)
      entry = { image, areas: {} }
    }
    const areas = {}
    const byPosition = flags['by-position'] ? positionalNames(traced.regions) : null
    for (let i = 1; i <= count; i++) {
      const written = entry.areas[String(i)]?.trim()
      areas[String(i)] =
        written && !isPlaceholder(written) ? written : (byPosition?.[i - 1] ?? (written || placeholderLabel(page.name, i)))
    }
    next[page.id] = { image, areas }

    const names = Object.values(areas)
    const changed = traced.regions.some((r, i) => r.label !== names[i])
    traced.regions.forEach((r, i) => (r.label = names[i]))
    traced.review.placeholderLabels = names.filter(isPlaceholder).length
    if (changed) writeTraced(root, traced)
    placeholders += traced.review.placeholderLabels
    const todo = traced.review.placeholderLabels
    console.log(`${todo ? 'NAME    ' : 'OK      '}${page.id}  ${count} areas${todo ? `, ${todo} still to name` : ''}`)
  }

  writeLabels(root, manifest.pack, next)
  console.log(
    placeholders
      ? `\n${placeholders} areas still have placeholder names in art/${manifest.pack}/labels.json.\nUse pnpm packs sheet ${manifest.pack} to see which number is which area, write the names, then run pnpm packs labels ${manifest.pack} again.`
      : `\nEvery area has a name. Next: pnpm packs publish ${manifest.pack}`,
  )
}

function status() {
  const manifests = packId ? [requirePack()] : readManifests(root)
  for (const manifest of manifests) printReport(report(manifest))
}

function publish() {
  const manifest = requirePack()
  const result = report(manifest)
  if (!result.ready) {
    printReport(result)
    fail('\nNot published: finish the steps above first.')
  }
  if (manifest.status !== 'published') writeManifest(root, { ...manifest, status: 'published' })
  writeRegistry(root)
  console.log(`${manifest.name} is published. It's listed for everyone and can be bought on its own.
Run pnpm test before committing.`)
}

function unpublish() {
  const manifest = requirePack()
  writeManifest(root, { ...manifest, status: 'draft' })
  writeRegistry(root)
  console.log(`${manifest.name} is a draft again: shown only in development and the v0 preview.`)
}

function icons() {
  console.log(`Set "icon" in pages.json to one of:\n  ${PACK_ICON_NAMES.join('\n  ')}\n\nPreview them at https://lucide.dev/icons`)
}

function sync() {
  console.log(writeRegistry(root) ? 'Updated lib/templates/registry.generated.ts' : 'The registry is already up to date.')
}

// Label sheets: four pages per sheet, each area filled and numbered at its roomiest point.

const TILE = 600
const PROBE = 300
const FILLS = ['#f7c8c2', '#fde7a6', '#fff6b8', '#d9f2c4', '#c9efe6', '#cfdcf7', '#e6d4f7', '#fbd9ea']
const DIGIT_SEGMENTS = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg']

async function sheet() {
  const manifest = requirePack()
  const traced = manifest.pages.map((p) => readTraced(root, manifest.pack, p.id)).filter(Boolean)
  if (!traced.length) fail(`Nothing traced yet. Run pnpm packs trace ${manifest.pack} first.`)
  const dir = paths.review(root, manifest.pack)
  mkdirSync(dir, { recursive: true })

  const hard = []
  for (let start = 0; start < traced.length; start += 4) {
    const group = traced.slice(start, start + 4)
    const tiles = []
    for (const [i, page] of group.entries()) {
      const { svg, tight } = await numberedPage(page)
      hard.push(...tight.map((n) => `${page.id} #${n}`))
      tiles.push({ input: await sharp(Buffer.from(svg)).png().toBuffer(), left: (i % 2) * TILE, top: Math.floor(i / 2) * TILE })
    }
    const file = join(dir, `labels-${start / 4 + 1}.png`)
    await sharp({ create: { width: TILE * 2, height: TILE * Math.ceil(group.length / 2), channels: 3, background: '#ffffff' } })
      .composite(tiles)
      .png()
      .toFile(file)
    console.log(`${relative(root, file)}  ${group.map((p) => p.id).join(', ')}`)
  }
  if (hard.length) console.log(`\nSmall areas, check them on the review sheet: ${hard.join(', ')}`)
  console.log(`\nThe sheets read left to right, top to bottom. Next: pnpm packs labels ${manifest.pack}`)
}

/** Draws a page with every area numbered where it has the most room. */
async function numberedPage(page) {
  const probe = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="${PROBE}" height="${PROBE}" shape-rendering="crispEdges">` +
      `<rect width="1000" height="1000" fill="#000"/>` +
      page.regions.map((r, i) => `<path d="${r.d}" fill="rgb(${i + 1},0,0)"/>`).join('') +
      '</svg>',
  )
  const raw = await sharp(probe).removeAlpha().raw().toBuffer()
  const owner = new Int16Array(PROBE * PROBE)
  for (let p = 0; p < owner.length; p++) owner[p] = raw[p * 3] - 1

  const depth = distanceToEdge(owner)
  const spots = page.regions.map(() => ({ at: -1, depth: 0 }))
  for (let p = 0; p < owner.length; p++) {
    const spot = spots[owner[p]]
    if (spot && depth[p] > spot.depth) Object.assign(spot, { at: p, depth: depth[p] })
  }

  const unit = 1000 / PROBE
  const tight = []
  const badges = spots.map((spot, i) => {
    if (spot.depth < 3) tight.push(i + 1)
    const x = spot.at < 0 ? 500 : ((spot.at % PROBE) + 0.5) * unit
    const y = spot.at < 0 ? 500 : (Math.floor(spot.at / PROBE) + 0.5) * unit
    return badge(i + 1, x, y)
  })

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 1048 1048" width="${TILE}" height="${TILE}">` +
    `<rect x="-24" y="-24" width="1048" height="1048" fill="#ffffff"/>` +
    `<g stroke="#2b2b2b" stroke-width="6" stroke-linejoin="round">` +
    page.regions.map((r, i) => `<path d="${r.d}" fill="${FILLS[i % FILLS.length]}"/>`).join('') +
    page.details.map((d) => `<path d="${d.d}" fill="#2b2b2b" stroke="none"/>`).join('') +
    `</g>${badges.join('')}</svg>`
  return { svg, tight }
}

/** Chamfer distance, in probe pixels, from each pixel to the nearest pixel of a different area. */
function distanceToEdge(owner) {
  const n = PROBE
  const d = new Float32Array(n * n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const p = y * n + x
      const edge =
        x === 0 || y === 0 || x === n - 1 || y === n - 1 ||
        owner[p - 1] !== owner[p] || owner[p + 1] !== owner[p] || owner[p - n] !== owner[p] || owner[p + n] !== owner[p]
      d[p] = edge ? 0 : Infinity
    }
  }
  const pass = (xs, ys, steps) => {
    for (const y of ys) {
      for (const x of xs) {
        const p = y * n + x
        for (const [dx, dy, cost] of steps) {
          const qx = x + dx
          const qy = y + dy
          if (qx >= 0 && qy >= 0 && qx < n && qy < n) d[p] = Math.min(d[p], d[qy * n + qx] + cost)
        }
      }
    }
  }
  const up = [...Array(n).keys()]
  const down = [...up].reverse()
  pass(up, up, [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.4], [1, -1, 1.4]])
  pass(down, down, [[1, 0, 1], [0, 1, 1], [1, 1, 1.4], [-1, 1, 1.4]])
  return d
}

/** A white tag with the area number drawn as seven-segment digits, so no font is needed. */
function badge(number, cx, cy) {
  const digits = String(number).split('').map(Number)
  const [w, h, gap] = [20, 34, 8]
  const width = digits.length * w + (digits.length - 1) * gap
  const [left, top] = [cx - width / 2, cy - h / 2]
  const segment = (x, y, letter) => {
    const [x0, y0, x1, y1] = {
      a: [0, 0, w, 0], b: [w, 0, w, h / 2], c: [w, h / 2, w, h], d: [0, h, w, h],
      e: [0, h / 2, 0, h], f: [0, 0, 0, h / 2], g: [0, h / 2, w, h / 2],
    }[letter]
    return `M${x + x0} ${y + y0}L${x + x1} ${y + y1}`
  }
  const d = digits
    .map((digit, i) => [...DIGIT_SEGMENTS[digit]].map((s) => segment(left + i * (w + gap), top, s)).join(''))
    .join('')
  return (
    `<rect x="${left - 12}" y="${top - 11}" width="${width + 24}" height="${h + 22}" rx="10" fill="#ffffff" stroke="#2b2b2b" stroke-width="4"/>` +
    `<path d="${d}" fill="none" stroke="#111111" stroke-width="6" stroke-linecap="round"/>`
  )
}

const commands = { new: create, prompts, trace, sheet, labels, status, publish, unpublish, icons, sync }

if (!command || command === 'help' || flags.help) {
  console.log(HELP)
} else if (!commands[command]) {
  fail(`Unknown command "${command}".\n\n${HELP}`)
} else {
  await commands[command]()
}
