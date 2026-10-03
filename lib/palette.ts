/**
 * The twelve crayons, in pairs of a bold color and its softer partner. The first six keys shipped
 * on their own and stay unchanged, because saved artwork stores these keys.
 */
export const PALETTE = [
  { key: 'red', label: '红色' },
  { key: 'pink', label: '粉色' },
  { key: 'orange', label: '橙色' },
  { key: 'peach', label: '桃色' },
  { key: 'yellow', label: '黄色' },
  { key: 'lime', label: '青柠绿' },
  { key: 'green', label: '绿色' },
  { key: 'sky', label: '天蓝色' },
  { key: 'blue', label: '蓝色' },
  { key: 'purple', label: '紫色' },
  { key: 'brown', label: '棕色' },
  { key: 'gray', label: '灰色' },
] as const

/**
 * The 24 pencils for grown-up pages: six color families, each in four shades from pale to deep, so a
 * petal or leaf can be shaded within one family. Keys are stored in saved artwork, so never rename them.
 */
export const GROWN_UP_FAMILIES = [
  {
    name: '玫瑰',
    colors: [
      { key: 'rose-pale', label: '浅粉' },
      { key: 'rose-soft', label: '粉色' },
      { key: 'rose-mid', label: '玫瑰红' },
      { key: 'rose-deep', label: '酒红' },
    ],
  },
  {
    name: '阳光',
    colors: [
      { key: 'sun-pale', label: '奶油黄' },
      { key: 'sun-soft', label: '金黄' },
      { key: 'sun-mid', label: '橘色' },
      { key: 'sun-deep', label: '铁锈红' },
    ],
  },
  {
    name: '树叶',
    colors: [
      { key: 'leaf-pale', label: '开心果绿' },
      { key: 'leaf-soft', label: '春绿' },
      { key: 'leaf-mid', label: '叶绿' },
      { key: 'leaf-deep', label: '森林绿' },
    ],
  },
  {
    name: '海洋',
    colors: [
      { key: 'sea-pale', label: '雾蓝' },
      { key: 'sea-soft', label: '绿松石' },
      { key: 'sea-mid', label: '海蓝' },
      { key: 'sea-deep', label: '钴蓝' },
    ],
  },
  {
    name: '紫罗兰',
    colors: [
      { key: 'violet-pale', label: '薰衣草紫' },
      { key: 'violet-soft', label: '丁香紫' },
      { key: 'violet-mid', label: '紫罗兰' },
      { key: 'violet-deep', label: '梅紫' },
    ],
  },
  {
    name: '大地',
    colors: [
      { key: 'earth-pale', label: '沙色' },
      { key: 'earth-soft', label: '石灰色' },
      { key: 'earth-mid', label: '陶土色' },
      { key: 'earth-deep', label: '可可色' },
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
