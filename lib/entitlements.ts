import { useCallback, useMemo, useSyncExternalStore } from 'react'
import useSWR, { mutate } from 'swr'
import { useAuthState } from '@/lib/auth/client'
import { LIVE_PAYMENTS, countsInThisMode } from '@/lib/billing/mode'
import { readSavedRights, saveRights, type RightsRow } from '@/lib/billing/saved-rights'
import type { Mandala } from '@/lib/mandalas'
import { PACK_BY_ID, type PackId } from '@/lib/packs'
import { createClient } from '@/lib/supabase/client'

export type Rights = Readonly<{ packs: ReadonlySet<string> }>

/** `source_id` is the Checkout Session that paid for it (`cs_live_…`, `cs_test_…`) or `comp:…` for a gift. */
type EntitlementRow = RightsRow

const NO_PACKS: ReadonlySet<string> = new Set()

/**
 * `starts_at` is stamped by the database clock and `now` comes from the device. A device running a
 * second behind would treat a pack bought a moment ago as not started yet, and keep it locked until
 * the next reload.
 */
export const CLOCK_SKEW_MS = 5 * 60_000

/**
 * Folds the parent's entitlement rows into the packs that are open at `now`. Only `pack` rows count:
 * the database still accepts `membership` rows so a subscription could return later, but none opens
 * anything today. With `live` (production), packs bought with a Stripe test card don't count.
 */
export function activeRights(rows: readonly EntitlementRow[], now: number, live: boolean = LIVE_PAYMENTS): Rights {
  const packs = new Set(
    rows.flatMap((row) =>
      row.scope === 'pack' &&
      row.pack_id &&
      countsInThisMode(row.source_id, live) &&
      Date.parse(row.starts_at) <= now + CLOCK_SKEW_MS &&
      (!row.ends_at || Date.parse(row.ends_at) > now)
        ? [row.pack_id]
        : [],
    ),
  )
  return { packs }
}

/**
 * A `pack` row opens a pack sold on its own, or Standard's locked pages: that row is written by the
 * $1.99 Standard unlock, which is bought separately from the picture packs.
 */
function packRowOpens(packId: PackId) {
  return packId === 'standard' || PACK_BY_ID[packId].soldSeparately
}

/** Free pages are open to everyone; paid pages need a `pack` row for their pack. */
export function canColor(mandala: Pick<Mandala, 'tier' | 'pack'>, rights: Rights) {
  if (mandala.tier === 'free') return true
  return packRowOpens(mandala.pack) && rights.packs.has(mandala.pack)
}

/** Database errors carry a code; a request that never reached the server (offline) has none. */
function isUnreachable(error: { code?: string }) {
  return !error.code || (typeof navigator !== 'undefined' && navigator.onLine === false)
}

export async function fetchRights([, parentId]: readonly [string, string]): Promise<Rights> {
  const { data, error } = await createClient()
    .from('entitlements')
    .select('scope, pack_id, source_id, starts_at, ends_at')
    .eq('parent_id', parentId)
    .eq('scope', 'pack')
    .is('revoked_at', null)
  if (error) {
    // Offline, the packs this device last confirmed for this parent stay open (lib/billing/saved-rights.ts).
    const saved = isUnreachable(error) ? readSavedRights() : null
    if (saved?.parentId === parentId) return activeRights(saved.rows, Date.now())
    console.error('Loading purchases failed', error.code)
    throw new Error('暂时无法查看你的购买记录。')
  }
  saveRights(parentId, data as EntitlementRow[])
  return activeRights(data as EntitlementRow[], Date.now())
}

/**
 * Whether two answers open the same packs. SWR's default comparison can't see inside a Set, so every
 * answer looked unchanged to it: a pack bought (or refunded) during a visit stayed as it was until
 * the page was reloaded.
 */
export function sameRights(a: Rights | undefined, b: Rights | undefined) {
  if (a === b) return true
  if (!a || !b || a.packs.size !== b.packs.size) return false
  for (const pack of a.packs) if (!b.packs.has(pack)) return false
  return true
}

/** Re-reads the parent's packs everywhere they're shown, after a purchase is recorded. */
export function refreshEntitlements() {
  return mutate((key) => Array.isArray(key) && key[0] === 'entitlements')
}

const subscribeToConnection = (listener: () => void) => {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

function useOnline() {
  return useSyncExternalStore(subscribeToConnection, () => navigator.onLine, () => true)
}

/**
 * Pack rights come only from entitlement rows written by the billing server; guests get the free
 * flowers. The packs this device last confirmed (lib/billing/saved-rights.ts) show straight away
 * while the server is asked again, so paid pictures don't flash locked, and keep paid pictures open
 * offline for up to 30 days. Offline the sign-in itself can't be renewed either, so a device that
 * knows it's offline uses them without waiting for it. An explicit sign-out wipes them.
 */
export function useEntitlements() {
  const auth = useAuthState()
  const offline = !useOnline()
  const parentId = auth.user?.id ?? null
  // Re-read when the sign-in or connection changes; reading is cheap but not free.
  const saved = useMemo(() => readSavedRights(), [auth.status, parentId, offline])
  const remembered = useMemo(() => (saved ? activeRights(saved.rows, Date.now()) : undefined), [saved])
  const { data, error } = useSWR(parentId ? (['entitlements', parentId] as const) : null, fetchRights, {
    revalidateOnFocus: true,
    compare: sameRights,
    fallbackData: saved && saved.parentId === parentId ? remembered : undefined,
  })
  const signInPendingOffline = offline && auth.status !== 'signed-in'
  const packs = parentId ? (data?.packs ?? NO_PACKS) : signInPendingOffline ? (remembered?.packs ?? NO_PACKS) : NO_PACKS
  const ready =
    auth.status === 'signed-out' ||
    signInPendingOffline ||
    (auth.status === 'signed-in' && (data !== undefined || !!error))

  const isUnlocked = useCallback((mandala: Pick<Mandala, 'tier' | 'pack'>) => canColor(mandala, { packs }), [packs])

  return { packs, ready, failed: !!error && data === undefined, isUnlocked }
}
