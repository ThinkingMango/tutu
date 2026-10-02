import type { SupabaseClient } from '@supabase/supabase-js'
import type { Artwork, ArtworkLibrary, CloudArtwork } from '@/lib/artwork/library'
import { renderArtworkSvg } from '@/lib/cloud-sync/artwork-svg'
import { loadOutline } from '@/lib/templates/outlines'

const BUCKET = 'artwork'
const MAX_ROWS = 1000
const UPLOAD_CONCURRENCY = 3
const FILE_NAME = /^(art_[0-9a-f-]{32,36})\.svg$/
/** A file without a row may be another device mid-upload; only clean it up once it's clearly abandoned. */
const ORPHAN_GRACE_MS = 10 * 60 * 1000
const RETRY_BASE_MS = 30_000
const RETRY_MAX_MS = 5 * 60 * 1000
const REFRESH_MS = 5 * 60 * 1000
const CHANGE_DEBOUNCE_MS = 800

export type SyncProblem = 'offline' | 'unavailable'

export type SyncSnapshot = Readonly<{
  parentId: string | null
  /** Whether this parent has active cloud-saving consent. `null` until the first check finishes. */
  enabled: boolean | null
  running: boolean
  checkedAt: number | null
  /** Pictures whose row and image file are both in the parent's account. */
  cloudIds: ReadonlySet<string>
  /** Pictures removed from the account (on any device). The database refuses to save them again. */
  blockedIds: ReadonlySet<string>
  failedIds: ReadonlySet<string>
  problem: SyncProblem | null
}>

export type SyncState = 'signed-out' | 'checking' | 'off' | 'syncing' | 'synced' | 'waiting' | 'offline' | 'unavailable'

export type SyncSummary = Readonly<{
  state: SyncState
  /** Garden pictures on this device that belong in the cloud. */
  total: number
  saved: number
  waiting: number
  /** Garden pictures on this device that were removed from the account elsewhere. */
  removedElsewhere: number
  checkedAt: number | null
}>

const EMPTY: ReadonlySet<string> = new Set()

const INITIAL: SyncSnapshot = Object.freeze({
  parentId: null,
  enabled: null,
  running: false,
  checkedAt: null,
  cloudIds: EMPTY,
  blockedIds: EMPTY,
  failedIds: EMPTY,
  problem: null,
})

/** What the grown-up sees: counts come from what the database confirmed, never from what was attempted. */
export function summarizeSync(snapshot: SyncSnapshot, gallery: readonly Artwork[]): SyncSummary {
  const eligible = gallery.filter((artwork) => !snapshot.blockedIds.has(artwork.id))
  const saved = eligible.filter((artwork) => snapshot.cloudIds.has(artwork.id)).length
  const waiting = eligible.length - saved
  const base = {
    total: eligible.length,
    saved,
    waiting,
    removedElsewhere: gallery.length - eligible.length,
    checkedAt: snapshot.checkedAt,
  }
  const state: SyncState = !snapshot.parentId
    ? 'signed-out'
    : snapshot.enabled === null
      ? (snapshot.problem ?? 'checking')
      : !snapshot.enabled
        ? 'off'
        : snapshot.running && waiting > 0
          ? 'syncing'
          : snapshot.problem ?? (waiting > 0 ? 'waiting' : 'synced')
  return Object.freeze({ state, ...base })
}

type CloudRow = { id: string; template_id: string; template_version: number; fills: unknown; created_at: string }

type Deps = {
  library: ArtworkLibrary
  client: () => SupabaseClient
  now?: () => number
}

class SyncFailure extends Error {
  constructor(readonly problem: SyncProblem, detail?: string) {
    super(detail ?? problem)
  }
}

function isOffline(detail: string) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return /failed to fetch|networkerror|network request failed|fetch failed|load failed/i.test(detail)
}

function toFailure(error: unknown): SyncFailure {
  if (error instanceof SyncFailure) return error
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error)
  return new SyncFailure(isOffline(detail) ? 'offline' : 'unavailable', detail)
}

function isDuplicateFile(error: { message?: string; statusCode?: string | number; status?: number }) {
  return String(error.statusCode ?? error.status ?? '') === '409' || /already exists|duplicate/i.test(error.message ?? '')
}

export type CloudSync = ReturnType<typeof createCloudSync>

export function createCloudSync({ library, client, now = Date.now }: Deps) {
  const listeners = new Set<() => void>()
  let snapshot: SyncSnapshot = INITIAL
  let parentId: string | null = null
  let generation = 0
  let running: Promise<void> | null = null
  let again = false
  let paused = false
  let retryAttempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  const notify = () => listeners.forEach((listener) => listener())

  const update = (patch: Partial<SyncSnapshot>) => {
    snapshot = Object.freeze({ ...snapshot, ...patch })
    notify()
  }

  const scheduleRetry = (needed: boolean) => {
    clearTimeout(retryTimer)
    if (!needed) {
      retryAttempt = 0
      return
    }
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** retryAttempt)
    retryAttempt += 1
    retryTimer = setTimeout(() => void syncNow(), delay)
  }

  async function uploadArtwork(supabase: SupabaseClient, uid: string, artwork: Artwork, hasFile: boolean) {
    const version = library.templates.version(artwork.templateId, artwork.templateVersion)
    if (!version) throw new SyncFailure('unavailable', 'unknown template')
    const filePath = `${uid}/${artwork.id}.svg`

    if (!hasFile) {
      const outline = await loadOutline(version).catch((error: unknown) => {
        throw toFailure(error)
      })
      const svg = renderArtworkSvg(version, outline, artwork.fills)
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, new Blob([svg], { type: 'image/svg+xml' }), {
          contentType: 'image/svg+xml',
          upsert: false,
        })
      if (error && !isDuplicateFile(error as { message?: string; statusCode?: string })) throw toFailure(error)
    }

    const { error } = await supabase.from('artworks').insert({
      id: artwork.id,
      parent_id: uid,
      template_id: artwork.templateId,
      template_version: artwork.templateVersion,
      fills: artwork.fills,
      file_path: filePath,
      created_at: new Date(artwork.createdAt || now()).toISOString(),
    })
    if (error && error.code !== '23505') throw toFailure(error)
  }

  async function runOnce() {
    const uid = parentId
    if (!uid) return
    const gen = generation
    const live = () => gen === generation && uid === parentId

    update({ running: true })
    let needsRetry = false
    try {
      const supabase = client()
      const consent = await supabase.rpc('has_cloud_consent')
      if (consent.error) throw toFailure(consent.error)
      if (!live()) return
      if (!consent.data) {
        update({
          enabled: false,
          cloudIds: EMPTY,
          blockedIds: EMPTY,
          failedIds: EMPTY,
          problem: null,
          checkedAt: now(),
        })
        return
      }

      const bucket = supabase.storage.from(BUCKET)
      const [rowsResult, tombstonesResult, filesResult] = await Promise.all([
        supabase
          .from('artworks')
          .select('id, template_id, template_version, fills, created_at')
          .eq('parent_id', uid)
          .limit(MAX_ROWS),
        supabase.from('artwork_deletions').select('artwork_id').eq('parent_id', uid).limit(MAX_ROWS),
        bucket.list(uid, { limit: MAX_ROWS }),
      ])
      if (rowsResult.error) throw toFailure(rowsResult.error)
      if (tombstonesResult.error) throw toFailure(tombstonesResult.error)
      if (filesResult.error) throw toFailure(filesResult.error)
      if (!live()) return

      const rows = new Map((rowsResult.data as CloudRow[]).map((row) => [row.id, row]))
      const blocked = new Set((tombstonesResult.data as { artwork_id: string }[]).map((t) => t.artwork_id))
      const files = new Map<string, number>()
      for (const file of filesResult.data ?? []) {
        const match = FILE_NAME.exec(file.name)
        if (match) files.set(match[1], file.created_at ? Date.parse(file.created_at) : 0)
      }

      const removedHere = new Set(library.syncMarks().removed)
      const toDelete = [...rows.keys()].filter((id) => removedHere.has(id))
      if (toDelete.length > 0) {
        const { error } = await supabase.from('artworks').delete().eq('parent_id', uid).in('id', toDelete)
        if (error) throw toFailure(error)
        for (const id of toDelete) {
          rows.delete(id)
          blocked.add(id)
        }
      }
      if (!live()) return

      library.importFromCloud(
        [...rows.values()].map(
          (row): CloudArtwork => ({
            id: row.id,
            templateId: row.template_id,
            templateVersion: row.template_version,
            fills: row.fills,
            createdAt: Date.parse(row.created_at),
          }),
        ),
      )

      const cloudIds = new Set([...rows.keys()].filter((id) => files.has(id)))
      const failed = new Set<string>()
      update({ enabled: true, cloudIds: new Set(cloudIds), blockedIds: new Set(blocked), problem: null })

      const pending = library
        .getState()
        .gallery.filter((artwork) => !cloudIds.has(artwork.id) && !blocked.has(artwork.id))
      let offline = false
      const queue = [...pending]
      const worker = async () => {
        for (let artwork = queue.shift(); artwork && live() && !offline; artwork = queue.shift()) {
          try {
            await uploadArtwork(supabase, uid, artwork, files.has(artwork.id))
            if (!live()) return
            files.set(artwork.id, now())
            cloudIds.add(artwork.id)
            update({ cloudIds: new Set(cloudIds) })
          } catch (error) {
            const failure = toFailure(error)
            if (failure.problem === 'offline') offline = true
            else console.error('Cloud saving a garden picture failed', failure.message)
            failed.add(artwork.id)
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, worker))
      if (!live()) return
      for (const artwork of queue) failed.add(artwork.id)

      const onDevice = new Set(library.getState().gallery.map((artwork) => artwork.id))
      const cutoff = now() - ORPHAN_GRACE_MS
      const orphanFiles = [...files.entries()]
        .filter(([id]) => !rows.has(id) && !cloudIds.has(id) && !onDevice.has(id))
        .filter(([id, createdAt]) => removedHere.has(id) || blocked.has(id) || createdAt < cutoff)
        .map(([id]) => `${uid}/${id}.svg`)
      if (orphanFiles.length > 0) {
        const { error } = await bucket.remove(orphanFiles)
        if (error) {
          console.error('Removing cloud picture files failed', error.message)
          needsRetry = true
        }
      }

      needsRetry ||= failed.size > 0
      update({
        failedIds: failed,
        problem: offline ? 'offline' : null,
        checkedAt: now(),
      })
    } catch (error) {
      const failure = toFailure(error)
      if (failure.problem === 'unavailable') console.error('Cloud sync failed', failure.message)
      needsRetry = true
      if (live()) update({ problem: failure.problem, checkedAt: now() })
    } finally {
      if (live()) {
        update({ running: false })
        scheduleRetry(needsRetry)
      }
    }
  }

  /** Runs a sync now, or once more right after the one in progress. Resolves when it's done. */
  function syncNow(): Promise<void> {
    if (!parentId || paused) return Promise.resolve()
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      do {
        again = false
        await runOnce()
      } while (again && parentId && !paused)
    })().finally(() => {
      running = null
    })
    return running
  }

  /** Switches to another parent (or none). Nothing from the previous parent carries over. */
  function setParent(id: string | null) {
    if (id === parentId) return
    parentId = id
    generation += 1
    again = false
    clearTimeout(retryTimer)
    retryAttempt = 0
    snapshot = Object.freeze({ ...INITIAL, parentId: id })
    notify()
    if (id) void syncNow()
  }

  /** Stops starting new work and waits for the current run, e.g. while cloud saving is being turned off. */
  async function pause() {
    paused = true
    generation += 1
    again = false
    clearTimeout(retryTimer)
    await running
    if (snapshot.running) update({ running: false })
  }

  function resume() {
    paused = false
    return syncNow()
  }

  /** Watches for garden changes, reconnects and returning to the tab. Returns a cleanup function. */
  function start() {
    const galleryKey = () =>
      library
        .getState()
        .gallery.map((artwork) => artwork.id)
        .join(',')
    let lastKey = galleryKey()
    let debounce: ReturnType<typeof setTimeout> | undefined

    const unsubscribe = library.subscribe(() => {
      const key = galleryKey()
      if (key === lastKey) return
      lastKey = key
      clearTimeout(debounce)
      debounce = setTimeout(() => void syncNow(), CHANGE_DEBOUNCE_MS)
    })
    const onOnline = () => void syncNow()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!snapshot.checkedAt || now() - snapshot.checkedAt > 60_000 || snapshot.problem) void syncNow()
    }
    const refresh = setInterval(() => {
      if (document.visibilityState === 'visible') void syncNow()
    }, REFRESH_MS)

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      clearTimeout(debounce)
      clearInterval(refresh)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => INITIAL,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setParent,
    syncNow,
    /** Waits for any sync in progress without starting another. */
    whenIdle: () => running ?? Promise.resolve(),
    pause,
    resume,
    start,
  }
}
