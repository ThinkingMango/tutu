import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { activeRights, canColor } from '@/lib/entitlements'
import { MANDALAS } from '@/lib/mandalas'
import { PACKS, SOLD_PACKS, packPages } from '@/lib/packs'
import { SHOW_DRAFT_PACKS } from '@/lib/templates/traced'
import { readManifests } from '@/scripts/pack/pack-files'

const root = join(__dirname, '..')
const published = readManifests(root).filter((m) => m.status === 'published')

const NOW = Date.parse('2026-09-27T12:00:00Z')
const row = (scope: 'membership' | 'pack', pack_id: string | null, ends_at: string | null = null) => ({
  scope,
  pack_id,
  source_id: 'cs_live_a1',
  starts_at: '2026-09-01T00:00:00Z',
  ends_at,
})

describe('pack rights', () => {
  const ocean = packPages('ocean-friends')[0]

  it('unlocks a pack page with that pack, but not with nothing', () => {
    expect(canColor(ocean, activeRights([], NOW))).toBe(false)
    expect(canColor(ocean, activeRights([row('pack', 'ocean-friends')], NOW))).toBe(true)
  })

  it('opens nothing with a membership row, even one that never ends', () => {
    const membershipOnly = activeRights([row('membership', null)], NOW)
    expect(membershipOnly.packs.size).toBe(0)
    for (const page of MANDALAS.filter((m) => m.tier === 'paid')) {
      expect(canColor(page, membershipOnly), page.id).toBe(false)
    }
  })

  it('ignores expired and not-yet-started rows', () => {
    const expired = activeRights([row('pack', 'ocean-friends', '2026-09-20T00:00:00Z')], NOW)
    expect(canColor(ocean, expired)).toBe(false)

    const future = activeRights([{ ...row('pack', 'ocean-friends'), starts_at: '2026-10-01T00:00:00Z' }], NOW)
    expect(canColor(ocean, future)).toBe(false)
  })

  it('opens a pack bought a moment ago on a device whose clock runs a little behind', () => {
    const justBought = { ...row('pack', 'ocean-friends'), starts_at: new Date(NOW + 2_000).toISOString() }
    expect(canColor(ocean, activeRights([justBought], NOW))).toBe(true)
  })

  it('opens locked Standard pages with the Standard unlock, and nothing else', () => {
    const lockedStandard = packPages('standard').filter((m) => m.tier === 'paid')
    expect(lockedStandard).toHaveLength(6)
    const unlock = activeRights([row('pack', 'standard')], NOW)
    for (const page of lockedStandard) {
      expect(canColor(page, unlock), page.id).toBe(true)
      expect(canColor(page, activeRights([row('pack', 'ocean-friends')], NOW)), page.id).toBe(false)
    }
    expect(canColor(ocean, unlock)).toBe(false)

    const expiredUnlock = activeRights([row('pack', 'standard', '2026-09-20T00:00:00Z')], NOW)
    expect(canColor(lockedStandard[0], expiredUnlock)).toBe(false)
  })
})

describe('pack catalog', () => {
  it('lists Standard, then the published packs in art/ in their order, and never drafts outside development', () => {
    expect(SHOW_DRAFT_PACKS).toBe(false)
    expect(PACKS.map((p) => p.id)).toEqual(['standard', ...published.map((m) => m.pack)])
  })

  it('puts every page in exactly one listed pack', () => {
    const packIds = new Set(PACKS.map((p) => p.id))
    for (const page of MANDALAS) expect(packIds.has(page.pack), page.id).toBe(true)
    expect(PACKS.reduce((n, p) => n + packPages(p.id).length, 0)).toBe(MANDALAS.length)
  })

  it('makes Standard 4 free and 6 locked pages, and sells every published picture pack on its own', () => {
    const standard = packPages('standard')
    expect(standard.filter((m) => m.tier === 'free')).toHaveLength(4)
    expect(standard.filter((m) => m.tier === 'paid')).toHaveLength(6)
    expect(SOLD_PACKS.map((p) => p.id)).toEqual(published.map((m) => m.pack))
  })

  it('gives every page a unique id across all packs', () => {
    expect(new Set(MANDALAS.map((m) => m.id)).size).toBe(MANDALAS.length)
  })
})
