import { describe, expect, it } from 'vitest'
import { safeNext } from '@/lib/auth/redirect'
import {
  GROWN_UP_PACKS,
  GROWN_UPS_HREF,
  GROWN_UPS_OFFERED,
  KIDS_PACKS,
  PACKS,
  PACK_BY_ID,
  SOLD_GROWN_UP_PACKS,
  SOLD_KIDS_PACKS,
  SOLD_PACKS,
  colorHref,
  findKidsPack,
  packHref,
} from '@/lib/packs'

describe('grown-up packs', () => {
  it('splits every listed pack into exactly one shelf', () => {
    expect(KIDS_PACKS.every((p) => p.audience === 'children')).toBe(true)
    expect(GROWN_UP_PACKS.every((p) => p.audience === 'grown-ups')).toBe(true)
    expect(KIDS_PACKS.length + GROWN_UP_PACKS.length).toBe(PACKS.length)
  })

  it('keeps Zen Mandalas off the kids shelf and behind the parent gate', () => {
    const zen = PACK_BY_ID['zen-mandalas']
    expect(zen.audience).toBe('grown-ups')
    expect(findKidsPack(zen.id)).toBeUndefined()
    expect(packHref(zen.id)).toBe(GROWN_UPS_HREF)

    const page = colorHref({ id: 'lotus-bloom', pack: zen.id })
    expect(page).toBe('/parent/color/lotus-bloom')
    expect(safeNext(page)).toBe(page)
  })

  it('sells every published pack in exactly one Pricing group, grown-ups last', () => {
    expect(SOLD_KIDS_PACKS.every((p) => p.audience === 'children')).toBe(true)
    expect(SOLD_GROWN_UP_PACKS.every((p) => p.audience === 'grown-ups')).toBe(true)
    expect([...SOLD_KIDS_PACKS, ...SOLD_GROWN_UP_PACKS].map((p) => p.id).sort()).toEqual(
      SOLD_PACKS.map((p) => p.id).sort(),
    )
  })

  it('lists and sells no grown-up pack while they are shelved', () => {
    if (GROWN_UPS_OFFERED) return
    expect(GROWN_UP_PACKS).toEqual([])
    expect(SOLD_GROWN_UP_PACKS).toEqual([])
    expect(PACKS.some((p) => p.audience === 'grown-ups')).toBe(false)
    expect(SOLD_PACKS.some((p) => p.audience === 'grown-ups')).toBe(false)
    expect(PACK_BY_ID['zen-mandalas'].name).toBe('禅意曼陀罗')
  })

  it('leaves children pages in the kids area', () => {
    expect(colorHref({ id: 'daisy', pack: 'standard' })).toBe('/color/daisy')
    expect(packHref('standard')).toBe('/packs/standard')
    expect(findKidsPack('standard')?.id).toBe('standard')
  })
})
