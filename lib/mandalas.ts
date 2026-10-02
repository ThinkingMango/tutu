import type { PackId } from '@/lib/packs'
import { registerInlineOutline, registerOutlineLoader } from '@/lib/templates/outlines'
import { listedTracedPages } from '@/lib/templates/traced'

export type PetalShape = 'round' | 'almond' | 'pointy' | 'heart'
export type Tier = 'free' | 'paid'

type Layer = {
  count: number
  shape: PetalShape
  /** Distance from the center where the petal starts. */
  r0: number
  /** Distance from the center where the petal tip ends. */
  r1: number
  /** 1 = neighbouring petals just touch. Lower leaves gaps. */
  fullness?: number
  /** Rotation offset as a fraction of one petal step (0.5 = between petals). */
  offset?: number
}

/** One tappable area as drawn: its id, outline path and spoken name. */
export type Region = Readonly<{ id: string; d: string; label: string }>

/** What the app knows about an area without its outline: enough to check, save and announce it. */
export type RegionInfo = Readonly<{ id: string; label: string }>

/** Ink drawn on top of the regions, such as eyes and smiles. It can't be colored or tapped. */
export type Detail = Readonly<{ d: string; kind: 'dot' | 'line' }>

/** How heavy the outline is drawn: bold for small hands, fine for detailed grown-up pages. */
export type LineWeight = 'bold' | 'fine'

export type Drawing = { regions: Region[]; details?: Detail[]; line?: LineWeight }

type PetalVersion = {
  version: number
  layers: Layer[]
  centerRadius: number
}

type DrawnVersion = {
  version: number
  drawing: Drawing
}

/** An outline as stored: areas in drawing order, then ink details. */
export type RawOutline = {
  regions: readonly { id: string; d: string }[]
  details?: readonly { kind: string; d: string }[]
}

/** A traced page: its areas are listed here, and its outline is fetched the first time it's drawn. */
type LoadedVersion = {
  version: number
  regions: readonly RegionInfo[]
  line?: LineWeight
  load: () => Promise<RawOutline>
}

export type VersionDefinition = PetalVersion | DrawnVersion | LoadedVersion

export type TemplateDefinition = {
  id: string
  name: string
  tier: Tier
  /** The pack this page is shown in. Pages without one belong to the Standard pack. */
  pack?: PackId
  /**
   * Append-only. Published versions are never edited: saved artwork is pinned to the
   * version it was started on, so changing one would scramble existing drawings.
   */
  versions: VersionDefinition[]
}

/**
 * One immutable version of a page, without its outline. The outline is the bulk of a page, so it
 * comes from lib/templates/outlines.ts (`useOutline`, `loadOutline`) only where the page is drawn.
 */
export type TemplateVersion = Readonly<{
  templateId: string
  version: number
  regions: readonly RegionInfo[]
  line: LineWeight
  /** The only region ids that may ever hold a color for this version. */
  approvedRegionIds: readonly string[]
}>

/** The paths that draw a version, in the same order as its regions. */
export type Outline = Readonly<{
  regions: readonly Readonly<{ id: string; d: string }>[]
  details: readonly Detail[]
}>

export type Mandala = Readonly<{
  id: string
  name: string
  tier: Tier
  pack: PackId
  latestVersion: number
  versions: readonly TemplateVersion[]
}>

export type TemplateSource = {
  version: (templateId: string, version: number) => TemplateVersion | undefined
  latest: (templateId: string) => TemplateVersion | undefined
}

type Pt = [number, number]
type Segment = [Pt, Pt, Pt]

const CENTER = 500

/** Where each shape is widest, used to size petals so neighbours meet. */
const SHAPE_METRICS: Record<PetalShape, { peak: number; at: number }> = {
  round: { peak: 0.75, at: 0.6 },
  almond: { peak: 0.75, at: 0.5 },
  pointy: { peak: 0.6, at: 0.4 },
  heart: { peak: 0.8, at: 0.65 },
}

/** Right half of a petal pointing straight up, from base to tip (tip has x = 0). */
function rightHalf(shape: PetalShape, r0: number, r1: number, w: number): Segment[] {
  const h = r1 - r0
  switch (shape) {
    case 'round':
      return [
        [
          [w, -(r0 + 0.3 * h)],
          [w, -r1],
          [0, -r1],
        ],
      ]
    case 'almond':
      return [
        [
          [w, -(r0 + 0.2 * h)],
          [w, -(r0 + 0.8 * h)],
          [0, -r1],
        ],
      ]
    case 'pointy':
      return [
        [
          [w, -(r0 + 0.3 * h)],
          [w * 0.55, -(r0 + 0.8 * h)],
          [0, -r1],
        ],
      ]
    case 'heart':
      return [
        [
          [w, -(r0 + 0.3 * h)],
          [w * 1.05, -r1],
          [w * 0.5, -r1],
        ],
        [
          [w * 0.15, -r1],
          [0, -(r1 - 0.05 * h)],
          [0, -(r1 - 0.12 * h)],
        ],
      ]
  }
}

function mirrorToClosedPetal(start: Pt, right: Segment[]): Segment[] {
  const points: Pt[] = [start, ...right.flat()]
  const reversed = points
    .slice()
    .reverse()
    .map(([x, y]) => [-x, y] as Pt)
  const left: Segment[] = []
  for (let i = 1; i < reversed.length; i += 3) {
    left.push([reversed[i], reversed[i + 1], reversed[i + 2]])
  }
  return [...right, ...left]
}

function rotate([x, y]: Pt, angle: number): Pt {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [x * cos - y * sin + CENTER, x * sin + y * cos + CENTER]
}

const fmt = (n: number) => Math.round(n * 10) / 10

function toPath(start: Pt, segments: Segment[], angle: number) {
  const [sx, sy] = rotate(start, angle)
  const curves = segments
    .map((seg) =>
      seg
        .map((p) => rotate(p, angle))
        .map(([x, y]) => `${fmt(x)} ${fmt(y)}`)
        .join(' '),
    )
    .map((s) => `C ${s}`)
    .join(' ')
  return `M ${fmt(sx)} ${fmt(sy)} ${curves} Z`
}

function circlePath(r: number) {
  return `M ${CENTER - r} ${CENTER} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`
}

function layerNames(total: number) {
  if (total === 1) return ['Petal']
  if (total === 2) return ['Outer petal', 'Inner petal']
  return ['Outer petal', 'Middle petal', 'Inner petal']
}

function buildRegions({ layers, centerRadius }: PetalVersion): Region[] {
  const names = layerNames(layers.length)
  const regions: Region[] = []

  layers.forEach((layer, layerIndex) => {
    const { count, shape, r0, r1, fullness = 1, offset = 0 } = layer
    const metrics = SHAPE_METRICS[shape]
    const widest = r0 + metrics.at * (r1 - r0)
    const w = (fullness * widest * Math.sin(Math.PI / count)) / metrics.peak
    const start: Pt = [0, -r0]
    const segments = mirrorToClosedPetal(start, rightHalf(shape, r0, r1, w))
    const step = (Math.PI * 2) / count

    for (let i = 0; i < count; i++) {
      regions.push({
        id: `l${layerIndex}-p${i}`,
        d: toPath(start, segments, step * (i + offset)),
        label: `${names[layerIndex]} ${i + 1}`,
      })
    }
  })

  regions.push({ id: 'center', d: circlePath(centerRadius), label: 'Flower center' })
  return regions
}

/** Validates a version's areas and returns a deeply frozen, approved snapshot. */
export function freezeVersion(
  templateId: string,
  version: number,
  regions: readonly RegionInfo[],
  line: LineWeight = 'bold',
): TemplateVersion {
  const ids = new Set<string>()
  for (const region of regions) {
    if (!region.id || !region.label) {
      throw new Error(`Template ${templateId} v${version}: region is missing an id or label`)
    }
    if (ids.has(region.id)) {
      throw new Error(`Template ${templateId} v${version}: duplicate region id "${region.id}"`)
    }
    ids.add(region.id)
  }

  return Object.freeze({
    templateId,
    version,
    regions: Object.freeze(regions.map(({ id, label }) => Object.freeze({ id, label }))),
    line,
    approvedRegionIds: Object.freeze([...ids]),
  })
}

/**
 * Validates an outline against its version: every area has a path, in the same order as the
 * version's regions, so a saved color can never land on a different area.
 */
export function freezeOutline(
  templateId: string,
  version: number,
  regions: RawOutline['regions'],
  details: RawOutline['details'] = [],
  expectedIds: readonly string[],
): Outline {
  if (regions.length !== expectedIds.length || regions.some((region, i) => region.id !== expectedIds[i])) {
    throw new Error(`Template ${templateId} v${version}: outline areas don't match the page`)
  }
  if (regions.some((region) => !region.d.trim())) {
    throw new Error(`Template ${templateId} v${version}: region is missing a path`)
  }
  if (details.some((detail) => !detail.d.trim())) {
    throw new Error(`Template ${templateId} v${version}: detail is missing a path`)
  }
  return Object.freeze({
    regions: Object.freeze(regions.map(({ id, d }) => Object.freeze({ id, d }))),
    details: Object.freeze(
      details.map(({ kind, d }) => Object.freeze({ kind: kind === 'line' ? ('line' as const) : ('dot' as const), d })),
    ),
  })
}

export function defineTemplate(def: TemplateDefinition): Mandala {
  if (def.versions.length === 0) throw new Error(`Template ${def.id} has no versions`)

  const versions = def.versions.map((v, index) => {
    if (v.version !== index + 1) {
      throw new Error(`Template ${def.id}: versions must be numbered 1, 2, 3… in order`)
    }
    if ('load' in v) {
      const frozen = freezeVersion(def.id, v.version, v.regions, v.line)
      registerOutlineLoader(frozen, async () => {
        const raw = await v.load()
        return freezeOutline(def.id, v.version, raw.regions, raw.details, frozen.approvedRegionIds)
      })
      return frozen
    }
    const drawing: Drawing = 'drawing' in v ? v.drawing : { regions: buildRegions(v) }
    const frozen = freezeVersion(def.id, v.version, drawing.regions, drawing.line)
    registerInlineOutline(
      frozen,
      freezeOutline(def.id, v.version, drawing.regions, drawing.details, frozen.approvedRegionIds),
    )
    return frozen
  })

  return Object.freeze({
    id: def.id,
    name: def.name,
    tier: def.tier,
    pack: def.pack ?? 'standard',
    latestVersion: versions.length,
    versions: Object.freeze(versions),
  })
}

export function latestVersion(mandala: Mandala): TemplateVersion {
  return mandala.versions[mandala.versions.length - 1]
}

export function createTemplateSource(mandalas: readonly Mandala[]): TemplateSource {
  const byId = new Map(mandalas.map((m) => [m.id, m]))
  return {
    version: (templateId, version) => byId.get(templateId)?.versions.find((v) => v.version === version),
    latest: (templateId) => {
      const mandala = byId.get(templateId)
      return mandala ? latestVersion(mandala) : undefined
    },
  }
}

const DEFINITIONS: TemplateDefinition[] = [
  {
    id: 'sunny',
    name: 'Sunny',
    tier: 'free',
    versions: [{ version: 1, layers: [{ count: 8, shape: 'round', r0: 40, r1: 450 }], centerRadius: 115 }],
  },
  {
    id: 'daisy',
    name: 'Daisy',
    tier: 'free',
    versions: [{ version: 1, layers: [{ count: 12, shape: 'almond', r0: 60, r1: 455 }], centerRadius: 125 }],
  },
  {
    id: 'tulip',
    name: 'Tulip Star',
    tier: 'free',
    versions: [
      {
        version: 1,
        layers: [
          { count: 6, shape: 'heart', r0: 50, r1: 455 },
          { count: 6, shape: 'almond', r0: 50, r1: 300, offset: 0.5, fullness: 0.85 },
        ],
        centerRadius: 95,
      },
    ],
  },
  {
    id: 'lotus',
    name: 'Lotus',
    tier: 'free',
    versions: [
      {
        version: 1,
        layers: [
          { count: 8, shape: 'pointy', r0: 50, r1: 460 },
          { count: 8, shape: 'round', r0: 50, r1: 310, offset: 0.5 },
        ],
        centerRadius: 95,
      },
    ],
  },
  {
    id: 'starburst',
    name: 'Starburst',
    tier: 'paid',
    versions: [
      {
        version: 1,
        layers: [
          { count: 10, shape: 'pointy', r0: 50, r1: 460 },
          { count: 5, shape: 'round', r0: 50, r1: 290 },
        ],
        centerRadius: 90,
      },
    ],
  },
  {
    id: 'clover',
    name: 'Clover',
    tier: 'paid',
    versions: [
      {
        version: 1,
        layers: [
          { count: 4, shape: 'heart', r0: 40, r1: 450 },
          { count: 4, shape: 'almond', r0: 40, r1: 400, offset: 0.5, fullness: 0.5 },
        ],
        centerRadius: 105,
      },
    ],
  },
  {
    id: 'dahlia',
    name: 'Dahlia',
    tier: 'paid',
    versions: [
      {
        version: 1,
        layers: [
          { count: 12, shape: 'round', r0: 50, r1: 460 },
          { count: 12, shape: 'round', r0: 50, r1: 340, offset: 0.5 },
          { count: 6, shape: 'round', r0: 40, r1: 220 },
        ],
        centerRadius: 75,
      },
    ],
  },
  {
    id: 'snowbloom',
    name: 'Snowbloom',
    tier: 'paid',
    versions: [
      {
        version: 1,
        layers: [
          { count: 6, shape: 'almond', r0: 60, r1: 460, fullness: 0.8 },
          { count: 6, shape: 'pointy', r0: 50, r1: 350, offset: 0.5 },
          { count: 6, shape: 'round', r0: 40, r1: 210 },
        ],
        centerRadius: 75,
      },
    ],
  },
  {
    id: 'poppy',
    name: 'Poppy',
    tier: 'paid',
    versions: [
      {
        version: 1,
        layers: [
          { count: 5, shape: 'round', r0: 40, r1: 450 },
          { count: 5, shape: 'heart', r0: 40, r1: 300, offset: 0.5 },
        ],
        centerRadius: 105,
      },
    ],
  },
  {
    id: 'garden',
    name: 'Garden',
    tier: 'paid',
    versions: [
      {
        version: 1,
        layers: [
          { count: 8, shape: 'heart', r0: 50, r1: 460 },
          { count: 8, shape: 'almond', r0: 50, r1: 360, offset: 0.5, fullness: 0.8 },
          { count: 8, shape: 'round', r0: 40, r1: 220 },
        ],
        centerRadius: 75,
      },
    ],
  },
]

export const MANDALAS: readonly Mandala[] = Object.freeze(
  [...DEFINITIONS, ...listedTracedPages()].map(defineTemplate),
)

export const templates = createTemplateSource(MANDALAS)

export function getMandala(id: string) {
  return MANDALAS.find((m) => m.id === id)
}
