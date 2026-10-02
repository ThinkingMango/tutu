/**
 * The twelve crayons, in pairs of a bold color and its softer partner. The first six keys shipped
 * on their own and stay unchanged, because saved artwork stores these keys.
 */
export const PALETTE = [
  { key: 'red', label: 'Red' },
  { key: 'pink', label: 'Pink' },
  { key: 'orange', label: 'Orange' },
  { key: 'peach', label: 'Peach' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'lime', label: 'Lime' },
  { key: 'green', label: 'Green' },
  { key: 'sky', label: 'Sky blue' },
  { key: 'blue', label: 'Blue' },
  { key: 'purple', label: 'Purple' },
  { key: 'brown', label: 'Brown' },
  { key: 'gray', label: 'Gray' },
] as const

/**
 * The 24 pencils for grown-up pages: six color families, each in four shades from pale to deep, so a
 * petal or leaf can be shaded within one family. Keys are stored in saved artwork, so never rename them.
 */
export const GROWN_UP_FAMILIES = [
  {
    name: 'Rose',
    colors: [
      { key: 'rose-pale', label: 'Blush' },
      { key: 'rose-soft', label: 'Pink' },
      { key: 'rose-mid', label: 'Rose' },
      { key: 'rose-deep', label: 'Wine' },
    ],
  },
  {
    name: 'Sun',
    colors: [
      { key: 'sun-pale', label: 'Butter' },
      { key: 'sun-soft', label: 'Gold' },
      { key: 'sun-mid', label: 'Tangerine' },
      { key: 'sun-deep', label: 'Rust' },
    ],
  },
  {
    name: 'Leaf',
    colors: [
      { key: 'leaf-pale', label: 'Pistachio' },
      { key: 'leaf-soft', label: 'Spring green' },
      { key: 'leaf-mid', label: 'Leaf green' },
      { key: 'leaf-deep', label: 'Forest' },
    ],
  },
  {
    name: 'Sea',
    colors: [
      { key: 'sea-pale', label: 'Mist' },
      { key: 'sea-soft', label: 'Turquoise' },
      { key: 'sea-mid', label: 'Ocean' },
      { key: 'sea-deep', label: 'Cobalt' },
    ],
  },
  {
    name: 'Violet',
    colors: [
      { key: 'violet-pale', label: 'Lavender' },
      { key: 'violet-soft', label: 'Lilac' },
      { key: 'violet-mid', label: 'Violet' },
      { key: 'violet-deep', label: 'Plum' },
    ],
  },
  {
    name: 'Earth',
    colors: [
      { key: 'earth-pale', label: 'Sand' },
      { key: 'earth-soft', label: 'Stone' },
      { key: 'earth-mid', label: 'Clay' },
      { key: 'earth-deep', label: 'Cocoa' },
    ],
  },
] as const

type KidColor = (typeof PALETTE)[number]
type GrownUpColor = (typeof GROWN_UP_FAMILIES)[number]['colors'][number]

export const GROWN_UP_PALETTE: readonly GrownUpColor[] = GROWN_UP_FAMILIES.flatMap<GrownUpColor>((family) => family.colors)

/** Every color any page can hold. Saved artwork is checked against this list. */
export const ALL_COLORS: readonly (KidColor | GrownUpColor)[] = [...PALETTE, ...GROWN_UP_PALETTE]

export type ColorKey = KidColor['key'] | GrownUpColor['key']

export const DEFAULT_COLOR: ColorKey = 'red'
export const DEFAULT_GROWN_UP_COLOR: ColorKey = 'rose-mid'

/** Turns one part back to white. Chosen from the palette like a color. */
export const ERASER = 'eraser'

export type Tool = ColorKey | typeof ERASER

export function colorVar(key: ColorKey) {
  return `var(--swatch-${key})`
}

export function colorLabel(key: ColorKey) {
  return ALL_COLORS.find((c) => c.key === key)?.label ?? key
}
