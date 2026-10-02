import { describe, expect, it } from 'vitest'
import {
  PACK_OFFERS,
  PACK_PRICE_CENTS,
  STANDARD_UNLOCK_CENTS,
  averagePerPackCents,
  bundleNudge,
  formatPrice,
  quotePacks,
} from '@/lib/billing/pricing'

describe('pack offers', () => {
  it('match the pricing table', () => {
    const table = PACK_OFFERS.map((offer) => [
      offer.name,
      offer.packs,
      formatPrice(offer.priceCents),
      formatPrice(averagePerPackCents(offer)),
    ])
    expect(table).toEqual([
      ['One pack', 1, '$4.99', '$4.99'],
      ['Any three packs', 3, '$12.99', '$4.33'],
      ['Any five packs', 5, '$19.99', '$4.00'],
    ])
    expect(formatPrice(STANDARD_UNLOCK_CENTS)).toBe('$1.99')
  })

  it('prices a pack the same whatever its page count', () => {
    expect(formatPrice(PACK_PRICE_CENTS)).toBe('$4.99')
    expect(quotePacks(1).totalCents).toBe(PACK_PRICE_CENTS)
  })
})

describe('quotePacks', () => {
  it.each([
    [0, 0, []],
    [1, 499, ['single']],
    [2, 998, ['single', 'single']],
    [3, 1299, ['bundle-3']],
    [4, 1798, ['bundle-3', 'single']],
    [5, 1999, ['bundle-5']],
    [6, 2498, ['bundle-5', 'single']],
    [8, 3298, ['bundle-5', 'bundle-3']],
    [10, 3998, ['bundle-5', 'bundle-5']],
  ])('%i packs cost %i cents', (packs, totalCents, offers) => {
    const quote = quotePacks(packs)
    expect(quote.totalCents).toBe(totalCents)
    expect(quote.offers.map((o) => o.id)).toEqual(offers)
    expect(quote.savingsCents).toBe(packs * 499 - totalCents)
  })

  it('rejects counts that are not whole and positive', () => {
    expect(() => quotePacks(-1)).toThrow(RangeError)
    expect(() => quotePacks(1.5)).toThrow(RangeError)
  })
})

describe('bundleNudge', () => {
  it('points at the three-pack bundle from one or two packs', () => {
    expect(bundleNudge(1, 4)).toMatchObject({ offer: { id: 'bundle-3' }, morePacks: 2, extraCents: 800 })
    expect(bundleNudge(2, 4)).toMatchObject({ offer: { id: 'bundle-3' }, morePacks: 1, extraCents: 301 })
  })

  it('points at the five-pack bundle only when five packs can be chosen', () => {
    expect(bundleNudge(4, 4)).toBeNull()
    expect(bundleNudge(4, 5)).toMatchObject({ offer: { id: 'bundle-5' }, morePacks: 1, extraCents: 201 })
  })

  it('stays quiet once the order is already a bundle or nothing is left', () => {
    expect(bundleNudge(3, 4)).toBeNull()
    expect(bundleNudge(0, 0)).toBeNull()
  })
})
