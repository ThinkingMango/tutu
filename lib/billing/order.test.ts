import { describe, expect, it } from 'vitest'
import { MAX_ORDER_PACKS, STANDARD_UNLOCK_NAME, buildOrder, parseGrants } from '@/lib/billing/order'
import { SOLD_PACKS } from '@/lib/packs'

const NONE: ReadonlySet<string> = new Set()
const ids = SOLD_PACKS.map((pack) => pack.id)

function priced(packIds: string[], withStandard = false, owned = NONE) {
  const result = buildOrder({ packIds, withStandard }, owned)
  if ('error' in result) throw new Error(result.error)
  return result.order
}

describe('building an order on the server', () => {
  it('charges the cheapest bundle mix for the chosen packs', () => {
    expect(ids.length).toBeGreaterThanOrEqual(4)
    const order = priced(ids.slice(0, 4))
    expect(order.lines).toEqual([
      { name: 'Any three packs', unitCents: 1299, quantity: 1 },
      { name: 'One pack', unitCents: 499, quantity: 1 },
    ])
    expect(order.totalCents).toBe(1798)
    expect(order.grants).toEqual(ids.slice(0, 4))
  })

  it('adds the Standard unlock as its own line and grant', () => {
    const order = priced([ids[0]], true)
    expect(order.lines.at(-1)).toEqual({ name: STANDARD_UNLOCK_NAME, unitCents: 199, quantity: 1 })
    expect(order.totalCents).toBe(698)
    expect(order.grants).toEqual([ids[0], 'standard'])
  })

  it('sells the Standard unlock on its own', () => {
    expect(priced([], true).totalCents).toBe(199)
  })

  it('counts a pack once however often it is sent, in shelf order', () => {
    const order = priced([ids[1], ids[0], ids[1]])
    expect(order.grants).toEqual([ids[0], ids[1]])
    expect(order.totalCents).toBe(998)
  })

  it('rejects empty orders, unknown packs and packs already owned', () => {
    expect(buildOrder({ packIds: [], withStandard: false }, NONE)).toEqual({ error: 'empty' })
    expect(buildOrder({ packIds: ['standard'], withStandard: false }, NONE)).toEqual({ error: 'unknown_pack' })
    expect(buildOrder({ packIds: ['zen-mandalas'], withStandard: false }, NONE)).toEqual({ error: 'unknown_pack' })
    expect(buildOrder({ packIds: [ids[0]], withStandard: false }, new Set([ids[0]]))).toEqual({ error: 'already_owned' })
    expect(buildOrder({ packIds: [], withStandard: true }, new Set(['standard']))).toEqual({ error: 'already_owned' })
    expect(buildOrder({ packIds: Array(MAX_ORDER_PACKS + 1).fill(ids[0]), withStandard: false }, NONE)).toEqual({
      error: 'too_many',
    })
  })
})

describe('reading grants back from a paid checkout', () => {
  it('accepts known packs, Standard included', () => {
    expect(parseGrants(`${ids[0]},standard`)).toEqual([ids[0], 'standard'])
  })

  it('refuses anything it does not recognise', () => {
    expect(parseGrants(undefined)).toBeNull()
    expect(parseGrants('')).toBeNull()
    expect(parseGrants(`${ids[0]},not-a-pack`)).toBeNull()
    expect(parseGrants('__proto__')).toBeNull()
  })
})
