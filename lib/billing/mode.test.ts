import { describe, expect, it } from 'vitest'
import { countsInThisMode } from '@/lib/billing/mode'
import { activeRights, canColor } from '@/lib/entitlements'
import { packPages } from '@/lib/packs'

const NOW = Date.parse('2026-10-01T12:00:00Z')
const row = (source_id: string) => ({
  scope: 'pack',
  pack_id: 'ocean-friends',
  source_id,
  starts_at: '2026-09-01T00:00:00Z',
  ends_at: null,
})

describe('payment mode', () => {
  const ocean = packPages('ocean-friends')[0]

  it('ignores packs bought with a test card on the live site', () => {
    expect(countsInThisMode('cs_test_a1', true)).toBe(false)
    expect(canColor(ocean, activeRights([row('cs_test_a1')], NOW, true))).toBe(false)
  })

  it('opens real purchases and complimentary grants on the live site', () => {
    expect(canColor(ocean, activeRights([row('cs_live_a1')], NOW, true))).toBe(true)
    expect(canColor(ocean, activeRights([row('comp:ocean-friends:b8986e6c')], NOW, true))).toBe(true)
  })

  it('opens test purchases on previews, so checkout can be tried there', () => {
    expect(countsInThisMode('cs_test_a1', false)).toBe(true)
    expect(canColor(ocean, activeRights([row('cs_test_a1')], NOW, false))).toBe(true)
  })

  it('keeps a pack open on the live site when it was bought for real as well as in test mode', () => {
    expect(canColor(ocean, activeRights([row('cs_test_a1'), row('cs_live_a2')], NOW, true))).toBe(true)
  })
})
