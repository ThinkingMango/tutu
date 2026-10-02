import { act, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveRights } from '@/lib/billing/saved-rights'
import { refreshEntitlements, useEntitlements } from '@/lib/entitlements'

const PARENT = '00000000-0000-4000-8000-000000000001'
const { auth, result } = vi.hoisted(() => ({
  auth: { current: { status: 'signed-in', user: { id: '00000000-0000-4000-8000-000000000001', email: 't@example.com' } } as object },
  result: { current: Promise.resolve({ data: [] as unknown[] | null, error: null as unknown }) },
}))
vi.mock('@/lib/auth/client', () => ({ useAuthState: () => auth.current }))
vi.mock('@/lib/supabase/client', () => {
  const query = { select: () => query, eq: () => query, is: () => result.current }
  return { createClient: () => ({ from: () => query }) }
})

const row = (pack_id: string) => ({ scope: 'pack', pack_id, source_id: 'cs_live_', starts_at: '2026-01-01T00:00:00Z', ends_at: null })
// A fresh SWR cache for each test, as on a fresh page load.
const wrapper = ({ children }: { children: ReactNode }) => createElement(SWRConfig, { value: { provider: () => new Map() } }, children)

beforeEach(() => {
  auth.current = { status: 'signed-in', user: { id: PARENT, email: 't@example.com' } }
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

const answer = (packs: string[]) => Promise.resolve({ data: packs.map(row), error: null })
const unreachable = () => Promise.resolve({ data: null, error: { code: '', message: 'TypeError: Failed to fetch' } })

describe('packs bought or refunded during a visit', () => {
  it('open straight after the purchase is recorded, without a reload', async () => {
    // The app's shared SWR cache, which refreshEntitlements() reaches; a parent no other test uses.
    auth.current = { status: 'signed-in', user: { id: '00000000-0000-4000-8000-0000000000aa', email: 't@example.com' } }
    result.current = answer(['ocean-friends'])
    const { result: hook } = renderHook(() => useEntitlements())
    await waitFor(() => expect(hook.current.packs.has('ocean-friends')).toBe(true))

    result.current = answer(['ocean-friends', 'safari-garden'])
    await act(async () => {
      await refreshEntitlements()
    })
    await waitFor(() => expect(hook.current.packs.has('safari-garden')).toBe(true))
  })
})

describe('remembered packs', () => {
  it('show straight away, then follow the server, which may have refunded one', async () => {
    saveRights(PARENT, [row('safari-garden')])
    result.current = new Promise((resolve) => setTimeout(() => resolve({ data: [], error: null }), 50))
    const { result: hook } = renderHook(() => useEntitlements(), { wrapper })
    expect(hook.current.packs.has('safari-garden')).toBe(true)
    await waitFor(() => expect(hook.current.packs.has('safari-garden')).toBe(false))
  })

  it('keep paid packs open offline without waiting for the server to give up', async () => {
    saveRights(PARENT, [row('ocean-friends')])
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    result.current = new Promise(() => {}) // the request never comes back
    const { result: hook } = renderHook(() => useEntitlements(), { wrapper })
    expect(hook.current.ready).toBe(true)
    expect(hook.current.packs.has('ocean-friends')).toBe(true)
  })

  it('keep paid packs open offline while the sign-in itself can’t be renewed', () => {
    saveRights(PARENT, [row('ocean-friends')])
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    auth.current = { status: 'loading', user: null }
    const { result: hook } = renderHook(() => useEntitlements(), { wrapper })
    expect(hook.current.ready).toBe(true)
    expect(hook.current.packs.has('ocean-friends')).toBe(true)
  })

  it('aren’t used online while the sign-in is still being checked', () => {
    saveRights(PARENT, [row('ocean-friends')])
    auth.current = { status: 'loading', user: null }
    const { result: hook } = renderHook(() => useEntitlements(), { wrapper })
    expect(hook.current.packs.has('ocean-friends')).toBe(false)
  })

  it('fall back when the server is unreachable even if the device thinks it is online', async () => {
    saveRights(PARENT, [row('ocean-friends')])
    result.current = unreachable()
    const { result: hook } = renderHook(() => useEntitlements(), { wrapper })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(hook.current.packs.has('ocean-friends')).toBe(true)
  })
})
