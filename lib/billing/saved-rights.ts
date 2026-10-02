/**
 * The packs this device last confirmed with the server, so paid pictures stay open without the
 * internet (in the car, on a plane). They're used only when the purchases check can't reach the
 * server, trusted for at most 30 days, and wiped at sign-out. Like the rest of the paywall this lives
 * on the device: it keeps paying families coloring offline, it isn't a lock.
 */

export type RightsRow = {
  scope: string
  pack_id: string | null
  /** Kept only as far as its payment mode (`cs_live_`, `cs_test_`) or `comp:`, which is all that's checked. */
  source_id: string
  starts_at: string
  ends_at: string | null
}

export type SavedRights = Readonly<{ parentId: string; rows: readonly RightsRow[]; savedAt: number }>

const KEY = 'lm:rights'
export const SAVED_RIGHTS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function storage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** Payment ids aren't needed offline, only whether a row came from a live, test or gifted source. */
function sourceKind(sourceId: string) {
  if (sourceId.startsWith('comp:')) return 'comp:'
  if (sourceId.startsWith('cs_live_')) return 'cs_live_'
  if (sourceId.startsWith('cs_test_')) return 'cs_test_'
  return 'other'
}

export function saveRights(parentId: string, rows: readonly RightsRow[], now = Date.now()) {
  const saved: SavedRights = {
    parentId,
    rows: rows.map((row) => ({ ...row, source_id: sourceKind(row.source_id) })),
    savedAt: now,
  }
  try {
    storage()?.setItem(KEY, JSON.stringify(saved))
  } catch {
    // Full storage: offline coloring falls back to the free pictures.
  }
}

const isText = (value: unknown): value is string => typeof value === 'string'

function isRow(value: unknown): value is RightsRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    isText(row.scope) &&
    (row.pack_id === null || isText(row.pack_id)) &&
    isText(row.source_id) &&
    isText(row.starts_at) &&
    (row.ends_at === null || isText(row.ends_at))
  )
}

/** The saved packs, or null if there are none, they're unreadable, or they're more than 30 days old. */
export function readSavedRights(now = Date.now()): SavedRights | null {
  let value: unknown
  try {
    value = JSON.parse(storage()?.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const { parentId, rows, savedAt } = value as Record<string, unknown>
  if (!isText(parentId) || typeof savedAt !== 'number' || !Array.isArray(rows) || !rows.every(isRow)) return null
  if (savedAt > now || now - savedAt > SAVED_RIGHTS_MAX_AGE_MS) return null
  return { parentId, rows, savedAt }
}

export function forgetSavedRights() {
  try {
    storage()?.removeItem(KEY)
  } catch {}
}
