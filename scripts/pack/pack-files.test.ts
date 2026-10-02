import { describe, expect, it } from 'vitest'
import { isPlaceholder, positionalNames } from './pack-files'

const square = (cx: number, cy: number, r: number) =>
  `M ${cx - r} ${cy - r} L ${cx + r} ${cy - r} L ${cx + r} ${cy + r} L ${cx - r} ${cy + r} Z`

describe('positionalNames', () => {
  it('names the rings around the middle from the inside out', () => {
    const names = positionalNames([{ d: square(500, 500, 300) }, { d: square(500, 500, 40) }, { d: square(500, 500, 120) }])
    expect(names).toEqual(['Second ring around the centre', 'Centre', 'First ring around the centre'])
  })

  it('names every other area by its band and clock position, numbering repeats', () => {
    const names = positionalNames([
      { d: square(500, 380, 20) },
      { d: square(850, 500, 20) },
      { d: square(500, 900, 20) },
      { d: square(850, 500, 10) },
    ])
    expect(names).toEqual([
      "Inner ring, 12 o'clock",
      "Outer ring, 3 o'clock, piece 1",
      "Outer ring, 6 o'clock",
      "Outer ring, 3 o'clock, piece 2",
    ])
    for (const name of names) expect(isPlaceholder(name)).toBe(false)
  })
})
