import { STANDARD_UNLOCK_CENTS, quotePacks, type PackOffer } from '@/lib/billing/pricing'
import { PACK_BY_ID, SOLD_PACKS, type PackId } from '@/lib/packs'

export const STANDARD_UNLOCK_NAME = '标准画册解锁'
/** More than every pack there is, so a real order never reaches it. */
export const MAX_ORDER_PACKS = 40

export type OrderRequest = Readonly<{ packIds: readonly string[]; withStandard: boolean }>

export type OrderLine = Readonly<{ name: string; unitCents: number; quantity: number }>

export type Order = Readonly<{
  /** Every pack the order opens, written to `entitlements.pack_id`. Standard's locked pages are `standard`. */
  grants: readonly PackId[]
  lines: readonly OrderLine[]
  totalCents: number
  /** The pack names, for the receipt. */
  summary: string
}>

export type OrderError = 'empty' | 'unknown_pack' | 'already_owned' | 'too_many'

const SOLD_ORDER = new Map<string, number>(SOLD_PACKS.map((pack, index) => [pack.id, index]))

function offerLines(offers: readonly PackOffer[]): OrderLine[] {
  const lines = new Map<string, { name: string; unitCents: number; quantity: number }>()
  for (const offer of offers) {
    const line = lines.get(offer.id)
    if (line) line.quantity++
    else lines.set(offer.id, { name: offer.name, unitCents: offer.priceCents, quantity: 1 })
  }
  return [...lines.values()]
}

/**
 * Works out what the parent pays from the packs they picked, using only the prices on this server.
 * Anything the browser sends beyond the pack ids is ignored.
 */
export function buildOrder(request: OrderRequest, owned: ReadonlySet<string>): { order: Order } | { error: OrderError } {
  if (request.packIds.length > MAX_ORDER_PACKS) return { error: 'too_many' }
  const packIds = [...new Set(request.packIds)]
  if (packIds.some((id) => !SOLD_ORDER.has(id))) return { error: 'unknown_pack' }
  if (packIds.length === 0 && !request.withStandard) return { error: 'empty' }
  if (packIds.some((id) => owned.has(id)) || (request.withStandard && owned.has('standard'))) {
    return { error: 'already_owned' }
  }

  packIds.sort((a, b) => SOLD_ORDER.get(a)! - SOLD_ORDER.get(b)!)
  const quote = quotePacks(packIds.length)
  const lines = offerLines(quote.offers)
  if (request.withStandard) lines.push({ name: STANDARD_UNLOCK_NAME, unitCents: STANDARD_UNLOCK_CENTS, quantity: 1 })

  const grants = [...packIds, ...(request.withStandard ? ['standard'] : [])] as PackId[]
  return {
    order: {
      grants,
      lines,
      totalCents: quote.totalCents + (request.withStandard ? STANDARD_UNLOCK_CENTS : 0),
      summary: grants.map((id) => (id === 'standard' ? STANDARD_UNLOCK_NAME : PACK_BY_ID[id].name)).join('、'),
    },
  }
}

/** Reads the packs back from a paid checkout. A pack withdrawn from sale since is still granted. */
export function parseGrants(value: string | null | undefined): PackId[] | null {
  if (!value) return null
  const ids = [...new Set(value.split(','))]
  if (ids.length > MAX_ORDER_PACKS || ids.some((id) => !Object.hasOwn(PACK_BY_ID, id))) return null
  return ids as PackId[]
}
