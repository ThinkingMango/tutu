/**
 * Turns black-on-white line art into tap-to-fill areas.
 *
 * Each enclosed white shape becomes an area. The black lines are then shared out between the
 * areas they separate, so the areas meet edge to edge and the app draws its own uniform outline.
 * White shapes too small to tap are absorbed into their neighbours, and ink that sits inside a
 * single area without closing anything (eyes, smiles) is kept as an ink detail on top.
 */

export type SegmentOptions = {
  /** Grey values below this count as ink. */
  inkThreshold: number
  /** Smallest area kept as its own tap target, as a share of the whole canvas. */
  minAreaShare: number
  /** When set, areas narrower than this many pixels are absorbed into their neighbours too. */
  absorbThinnerThan?: number
  /**
   * When set, ink further than this many pixels from any area's edge is kept as linework on top, so
   * lines between absorbed shapes (leaf veins, petal ridges) still show on the page.
   */
  keepInkFartherThan?: number
}

export type SegmentedRegion = {
  area: number
  /** Width of the widest circle-ish spot inside the area, in pixels. */
  thickness: number
}

export type Segmentation = {
  width: number
  height: number
  /** Area index per pixel; `BACKGROUND` for the page outside every shape. */
  labels: Int32Array
  /** Sorted largest first, so drawing in order puts enclosed areas on top of their surroundings. */
  regions: SegmentedRegion[]
  /** 1 where an ink detail (eye, smile) is drawn on top. */
  detailMask: Uint8Array
  backgroundShare: number
  /** White shapes that were too small to tap and got absorbed. */
  absorbed: number
}

export const BACKGROUND = -1

const UNSET = -2

export function segment(gray: Uint8Array, width: number, height: number, options: SegmentOptions): Segmentation {
  const size = width * height
  if (gray.length !== size) throw new Error(`Expected ${size} pixels, got ${gray.length}`)
  const ink = new Uint8Array(size)
  for (let i = 0; i < size; i++) ink[i] = gray[i] < options.inkThreshold ? 1 : 0

  const minArea = Math.max(1, Math.round(options.minAreaShare * size))
  const stack = new Int32Array(size)

  const component = new Int32Array(size).fill(-1)
  const componentArea: number[] = []
  const componentTouchesEdge: boolean[] = []
  for (let start = 0; start < size; start++) {
    if (ink[start] || component[start] !== -1) continue
    const id = componentArea.length
    let area = 0
    let touchesEdge = false
    let top = 0
    stack[top++] = start
    component[start] = id
    while (top) {
      const p = stack[--top]
      area++
      const x = p % width
      const y = (p - x) / width
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true
      for (const q of neighbours4(p, x, y, width, height)) {
        if (q < 0 || ink[q] || component[q] !== -1) continue
        component[q] = id
        stack[top++] = q
      }
    }
    componentArea.push(area)
    componentTouchesEdge.push(touchesEdge)
  }

  const componentLabel = componentArea.map((area, id) =>
    componentTouchesEdge[id] ? BACKGROUND : area >= minArea ? id : UNSET,
  )
  let absorbed = componentLabel.filter((label) => label === UNSET).length

  const labels = new Int32Array(size).fill(UNSET)
  for (let i = 0; i < size; i++) {
    if (!ink[i]) labels[i] = componentLabel[component[i]]
  }

  const detailMask = findDetails(labels, ink, width, height, stack)
  growIntoInk(labels, width, height)

  if (options.absorbThinnerThan) {
    const thickness = measureThickness(labels, width, height, componentArea.length)
    const thin = new Set(
      componentLabel.filter((label) => label >= 0 && thickness[label] < options.absorbThinnerThan!),
    )
    if (thin.size) {
      for (let i = 0; i < size; i++) if (thin.has(labels[i])) labels[i] = UNSET
      growIntoInk(labels, width, height)
      absorbed += thin.size
    }
  }

  if (options.keepInkFartherThan) {
    const fromEdge = distanceFromEdge(labels, width, height)
    for (let i = 0; i < size; i++) {
      if (ink[i] && labels[i] !== BACKGROUND && fromEdge[i] > options.keepInkFartherThan) detailMask[i] = 1
    }
  }

  const order = [...new Set(labels)]
    .filter((label) => label !== BACKGROUND)
    .map((label) => ({ label, area: 0 }))
  const byLabel = new Map(order.map((entry) => [entry.label, entry]))
  let background = 0
  for (let i = 0; i < size; i++) {
    const entry = byLabel.get(labels[i])
    if (entry) entry.area++
    else background++
  }
  order.sort((a, b) => b.area - a.area)
  const remap = new Map(order.map((entry, index) => [entry.label, index]))
  for (let i = 0; i < size; i++) {
    if (labels[i] !== BACKGROUND) labels[i] = remap.get(labels[i])!
  }

  const thickness = measureThickness(labels, width, height, order.length)
  return {
    width,
    height,
    labels,
    regions: order.map((entry, index) => ({ area: entry.area, thickness: thickness[index] })),
    detailMask,
    backgroundShare: background / size,
    absorbed,
  }
}

/**
 * Ink pieces that touch exactly one area and nothing else are details drawn on top of that area.
 * At this point every unset pixel is ink, or a white speck too small to keep. Only the ink is drawn:
 * specks go to the area around them, so a cluster of them never turns into a black blob.
 */
function findDetails(labels: Int32Array, ink: Uint8Array, width: number, height: number, stack: Int32Array) {
  const size = width * height
  const seen = new Uint8Array(size)
  const detailMask = new Uint8Array(size)
  const pixels: number[] = []
  for (let start = 0; start < size; start++) {
    if (labels[start] !== UNSET || seen[start]) continue
    pixels.length = 0
    const touching = new Set<number>()
    let top = 0
    stack[top++] = start
    seen[start] = 1
    while (top) {
      const p = stack[--top]
      pixels.push(p)
      const x = p % width
      const y = (p - x) / width
      for (const q of neighbours8(p, x, y, width, height)) {
        if (q < 0) {
          touching.add(BACKGROUND)
          continue
        }
        if (labels[q] !== UNSET) {
          touching.add(labels[q])
          continue
        }
        if (seen[q]) continue
        seen[q] = 1
        stack[top++] = q
      }
    }
    if (touching.size === 1 && !touching.has(BACKGROUND)) {
      for (const p of pixels) if (ink[p]) detailMask[p] = 1
    }
  }
  return detailMask
}

/** Shares ink pixels out to the nearest labelled area, one ring at a time. */
function growIntoInk(labels: Int32Array, width: number, height: number) {
  const size = width * height
  let frontier: number[] = []
  for (let p = 0; p < size; p++) {
    if (labels[p] === UNSET) continue
    const x = p % width
    const y = (p - x) / width
    if (neighbours4(p, x, y, width, height).some((q) => q >= 0 && labels[q] === UNSET)) frontier.push(p)
  }
  while (frontier.length) {
    const next: number[] = []
    for (const p of frontier) {
      const x = p % width
      const y = (p - x) / width
      for (const q of neighbours4(p, x, y, width, height)) {
        if (q < 0 || labels[q] !== UNSET) continue
        labels[q] = labels[p]
        next.push(q)
      }
    }
    frontier = next
  }
  for (let p = 0; p < size; p++) if (labels[p] === UNSET) labels[p] = BACKGROUND
}

/** Twice the largest distance from any pixel to its area's edge. */
function measureThickness(labels: Int32Array, width: number, height: number, count: number) {
  const size = width * height
  const distance = new Int32Array(size).fill(-1)
  let frontier: number[] = []
  for (let p = 0; p < size; p++) {
    const x = p % width
    const y = (p - x) / width
    if (neighbours4(p, x, y, width, height).some((q) => q < 0 || labels[q] !== labels[p])) {
      distance[p] = 1
      frontier.push(p)
    }
  }
  const best = new Array<number>(count).fill(0)
  let step = 1
  while (frontier.length) {
    const next: number[] = []
    for (const p of frontier) {
      const label = labels[p]
      if (label >= 0 && step > best[label]) best[label] = step
      const x = p % width
      const y = (p - x) / width
      for (const q of neighbours4(p, x, y, width, height)) {
        if (q < 0 || distance[q] !== -1 || labels[q] !== label) continue
        distance[q] = step + 1
        next.push(q)
      }
    }
    frontier = next
    step++
  }
  return best.map((d) => d * 2)
}

/** Steps from each pixel to the nearest pixel of a different area, the page edge counting as one. */
function distanceFromEdge(labels: Int32Array, width: number, height: number) {
  const size = width * height
  const distance = new Int32Array(size).fill(-1)
  let frontier: number[] = []
  for (let p = 0; p < size; p++) {
    const x = p % width
    const y = (p - x) / width
    if (neighbours4(p, x, y, width, height).some((q) => q < 0 || labels[q] !== labels[p])) {
      distance[p] = 1
      frontier.push(p)
    }
  }
  while (frontier.length) {
    const next: number[] = []
    for (const p of frontier) {
      const x = p % width
      const y = (p - x) / width
      for (const q of neighbours4(p, x, y, width, height)) {
        if (q < 0 || distance[q] !== -1) continue
        distance[q] = distance[p] + 1
        next.push(q)
      }
    }
    frontier = next
  }
  return distance
}

function neighbours4(p: number, x: number, y: number, width: number, height: number) {
  return [
    x > 0 ? p - 1 : -1,
    x < width - 1 ? p + 1 : -1,
    y > 0 ? p - width : -1,
    y < height - 1 ? p + width : -1,
  ]
}

function neighbours8(p: number, x: number, y: number, width: number, height: number) {
  const out = neighbours4(p, x, y, width, height)
  const left = x > 0
  const right = x < width - 1
  const up = y > 0
  const down = y < height - 1
  out.push(
    left && up ? p - width - 1 : -1,
    right && up ? p - width + 1 : -1,
    left && down ? p + width - 1 : -1,
    right && down ? p + width + 1 : -1,
  )
  return out
}

export type PageCheck = { ok: boolean; problems: string[] }

export type Audience = 'children' | 'grown-ups'
export const AUDIENCES: readonly Audience[] = ['children', 'grown-ups']

export type PageRules = Readonly<{
  minRegions: number
  maxRegions: number
  /** Narrowest allowed area, in 1000-unit page space. */
  minThickness: number
  /** More background than this means the outline leaked open. */
  maxBackgroundShare: number
  /** Default smallest tap area, as a share of the canvas. A page's "minArea" overrides it. */
  minAreaShare: number
  /** Fold areas narrower than `minThickness` into their neighbours instead of failing the page. */
  absorbThin: boolean
  /** Keep the drawing's lines inside merged areas as linework on top. */
  keepLines: boolean
  /** Outline weight the app draws: bold for small hands, fine for detailed pages. */
  line: 'bold' | 'fine'
}>

export const AUDIENCE_RULES: Readonly<Record<Audience, PageRules>> = {
  children: {
    minRegions: 10,
    maxRegions: 24,
    minThickness: 40,
    maxBackgroundShare: 0.75,
    minAreaShare: 0.004,
    absorbThin: false,
    keepLines: false,
    line: 'bold',
  },
  // Fine detail for adults: areas can be as narrow as 10 units, which is still tappable with a stylus or fingertip.
  'grown-ups': {
  minRegions: 40,
  maxRegions: 640,
  minThickness: 10,
  maxBackgroundShare: 0.75,
  minAreaShare: 0.00025,
    absorbThin: true,
    keepLines: true,
    line: 'fine',
  },
}

export const PAGE_RULES = AUDIENCE_RULES.children

export function rulesFor(audience: string | undefined): PageRules {
  return audience === 'grown-ups' ? AUDIENCE_RULES['grown-ups'] : AUDIENCE_RULES.children
}

/** Applies the pack art rules to a traced page. `scale` converts pixels to page units. */
export function checkPage(result: Segmentation, scale = 1, rules: PageRules = PAGE_RULES): PageCheck {
  const problems: string[] = []
  const count = result.regions.length
  if (count < rules.minRegions || count > rules.maxRegions) {
    problems.push(`${count} areas (needs ${rules.minRegions}–${rules.maxRegions})`)
  }
  const thin = result.regions.filter((region) => region.thickness * scale < rules.minThickness).length
  if (thin) problems.push(`${thin} area${thin === 1 ? '' : 's'} narrower than ${rules.minThickness} units`)
  if (result.backgroundShare > rules.maxBackgroundShare) {
    problems.push(`background covers ${Math.round(result.backgroundShare * 100)}% (outline probably leaks)`)
  }
  return { ok: problems.length === 0, problems }
}
