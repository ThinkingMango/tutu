import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SAVED_RIGHTS_MAX_AGE_MS, forgetSavedRights, readSavedRights, saveRights } from '@/lib/billing/saved-rights'
import { canColor, fetchRights } from '@/lib/entitlements'
import { packPages } from '@/lib/packs'

const { result, signOut } = vi.hoisted(() => ({
  result: { current: { data: null as unknown, error: null as unknown } },
  signOut: vi.fn(),
}))
vi.mock('@/lib/supabase/client', () => {
  const query = { select: () => query, eq: () => query, is: () => Promise.resolve(result.current) }
  return {
    createClient: () => ({
      from: () => query,
      auth: { signOut, onAuthStateChange: () => ({ data: { subscription: {} } }) },
    }),
  }
})

const PARENT = '00000000-0000-4000-8000-000000000001'
const NOW = Date.parse('2026-10-01T12:00:00Z')
const ocean = packPages('ocean-friends')[0]
const row = (source_id = 'cs_live_a1b2c3') => ({
  scope: 'pack',
  pack_id: 'ocean-friends',
  source_id,
  starts_at: '2026-09-01T00:00:00Z',
  ends_at: null,
})
const OFFLINE = { data: null, error: { code: '', message: 'TypeError: Failed to fetch' } }

beforeEach(() => {
  result.current = { data: null, error: null }
  signOut.mockReset()
  signOut.mockResolvedValue({ error: null })
})

describe('packs remembered for offline coloring', () => {
  it('keeps only what offline coloring needs, not payment ids', () => {
    saveRights(PARENT, [row('cs_live_secretSession'), row('comp:ocean-friends:x')], NOW)
    expect(readSavedRights(NOW)?.rows.map((r) => r.source_id)).toEqual(['cs_live_', 'comp:'])
    expect(localStorage.getItem('lm:rights')).not.toContain('secretSession')
  })

  it('are trusted for 30 days, then forgotten', () => {
    saveRights(PARENT, [row()], NOW)
    expect(readSavedRights(NOW + SAVED_RIGHTS_MAX_AGE_MS)).not.toBeNull()
    expect(readSavedRights(NOW + SAVED_RIGHTS_MAX_AGE_MS + 1)).toBeNull()
    expect(readSavedRights(NOW - 1)).toBeNull()
  })

  it('ignore anything damaged or tampered into the wrong shape', () => {
    for (const value of ['not json', '{}', JSON.stringify({ parentId: PARENT, savedAt: NOW, rows: [{ scope: 1 }] })]) {
      localStorage.setItem('lm:rights', value)
      expect(readSavedRights(NOW)).toBeNull()
    }
  })

  it('are refreshed every time the server confirms the packs', async () => {
    result.current = { data: [row()], error: null }
    const rights = await fetchRights(['entitlements', PARENT])
    expect(canColor(ocean, rights)).toBe(true)
    expect(readSavedRights()?.parentId).toBe(PARENT)
  })

  it('keep paid packs open when the server can’t be reached', async () => {
    saveRights(PARENT, [row()])
    result.current = OFFLINE
    expect(canColor(ocean, await fetchRights(['entitlements', PARENT]))).toBe(true)
  })

  it('never open another parent’s packs', async () => {
    saveRights('00000000-0000-4000-8000-000000000002', [row()])
    result.current = OFFLINE
    await expect(fetchRights(['entitlements', PARENT])).rejects.toThrow(/暂时无法查看/)
  })

  it('aren’t used when the server answers with an error rather than being unreachable', async () => {
    saveRights(PARENT, [row()])
    result.current = { data: null, error: { code: '42501', message: 'permission denied' } }
    await expect(fetchRights(['entitlements', PARENT])).rejects.toThrow(/暂时无法查看/)
  })

  it('are wiped when a parent signs out, so the next person on the tablet doesn’t inherit them', async () => {
    saveRights(PARENT, [row()])
    const { authClient } = await import('@/lib/auth/client')
    await authClient.signOut()
    expect(readSavedRights()).toBeNull()
  })

  it('can be wiped on purpose', () => {
    saveRights(PARENT, [row()])
    forgetSavedRights()
    expect(readSavedRights()).toBeNull()
  })
})
