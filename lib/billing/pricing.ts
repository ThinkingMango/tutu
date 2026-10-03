/**
 * One-time prices, in US cents. Nothing here is a subscription: every purchase is kept for good.
 * Every pack costs the same however many pages it has.
 */

export const PACK_PRICE_CENTS = 499
export const STANDARD_UNLOCK_CENTS = 199

export type PackOfferId = 'single' | 'bundle-3' | 'bundle-5'

export type PackOffer = Readonly<{
  id: PackOfferId
  name: string
  /** How many packs the parent chooses for this price. */
  packs: number
  priceCents: number
}>

export const PACK_OFFERS: readonly PackOffer[] = Object.freeze([
  { id: 'single', name: '单本画册', packs: 1, priceCents: PACK_PRICE_CENTS },
  { id: 'bundle-3', name: '任选三本', packs: 3, priceCents: 1299 },
  { id: 'bundle-5', name: '任选五本', packs: 5, priceCents: 1999 },
])

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatPrice(cents: number) {
  return usd.format(cents / 100)
}

export function averagePerPackCents(offer: PackOffer) {
  return Math.round(offer.priceCents / offer.packs)
}

/** What the offer saves against buying the same packs one at a time. */
export function offerSavingsCents(offer: PackOffer) {
  return offer.packs * PACK_PRICE_CENTS - offer.priceCents
}

export type PackQuote = Readonly<{
  packs: number
  /** The offers that make up the cheapest total, largest first. */
  offers: readonly PackOffer[]
  totalCents: number
  savingsCents: number
}>

/** The cheapest mix of single packs and bundles for exactly `packs` chosen packs. */
export function quotePacks(packs: number): PackQuote {
  if (!Number.isInteger(packs) || packs < 0) throw new RangeError(`Pack count must be a whole number, got ${packs}`)

  const cost = [0]
  const choice: (PackOffer | null)[] = [null]
  for (let n = 1; n <= packs; n++) {
    cost[n] = Infinity
    choice[n] = null
    for (const offer of PACK_OFFERS) {
      if (offer.packs > n) continue
      const total = cost[n - offer.packs] + offer.priceCents
      if (total < cost[n]) {
        cost[n] = total
        choice[n] = offer
      }
    }
  }

  const offers: PackOffer[] = []
  for (let n = packs; n > 0; n -= choice[n]!.packs) offers.push(choice[n]!)
  offers.sort((a, b) => b.packs - a.packs)

  return { packs, offers, totalCents: cost[packs], savingsCents: packs * PACK_PRICE_CENTS - cost[packs] }
}

export type BundleNudge = Readonly<{ offer: PackOffer; morePacks: number; extraCents: number }>

/**
 * When a few more packs would reach a bundle, how many and what they'd add to the total. Only offered
 * when that many packs are still there to choose, and when it beats buying them one at a time.
 */
export function bundleNudge(selected: number, available: number): BundleNudge | null {
  const current = quotePacks(selected).totalCents
  for (const offer of PACK_OFFERS) {
    if (offer.packs <= selected || offer.packs > available) continue
    const target = quotePacks(offer.packs)
    if (!target.offers.includes(offer)) continue
    const morePacks = offer.packs - selected
    const extraCents = target.totalCents - current
    if (extraCents < morePacks * PACK_PRICE_CENTS) return { offer, morePacks, extraCents }
  }
  return null
}
