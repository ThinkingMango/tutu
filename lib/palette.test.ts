import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isColorKey } from '@/lib/artwork/library'
import { PACK_BY_ID } from '@/lib/packs'
import { ALL_COLORS, GROWN_UP_FAMILIES, GROWN_UP_PALETTE, PALETTE, colorLabel } from '@/lib/palette'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('palettes', () => {
  it('gives grown-ups 24 colors in six families of four shades', () => {
    expect(GROWN_UP_PALETTE).toHaveLength(24)
    expect(GROWN_UP_FAMILIES).toHaveLength(6)
    for (const family of GROWN_UP_FAMILIES) expect(family.colors, family.name).toHaveLength(4)
  })

  it('keeps the children’s twelve crayons as they were', () => {
    expect(PALETTE.map((c) => c.key)).toEqual([
      'red', 'pink', 'orange', 'peach', 'yellow', 'lime', 'green', 'sky', 'blue', 'purple', 'brown', 'gray',
    ])
  })

  it('uses unique keys and names, each with a color token', () => {
    const keys = ALL_COLORS.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
    const grownUpLabels = GROWN_UP_PALETTE.map((c) => c.label)
    expect(new Set(grownUpLabels).size).toBe(grownUpLabels.length)
    for (const key of keys) expect(css, key).toContain(`--swatch-${key}:`)
  })

  it('accepts grown-up colors in saved artwork and names them', () => {
    expect(isColorKey('violet-deep')).toBe(true)
    expect(colorLabel('violet-deep')).toBe('梅紫')
    expect(isColorKey('violet-extra')).toBe(false)
  })

  it('marks Zen Mandalas as a grown-up pack and every other pack as children’s', () => {
    for (const pack of Object.values(PACK_BY_ID)) {
      expect(pack.audience, pack.id).toBe(pack.id === 'zen-mandalas' ? 'grown-ups' : 'children')
    }
  })
})
