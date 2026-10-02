import type { TemplateSource, TemplateVersion } from '@/lib/mandalas'
import { ALL_COLORS, type ColorKey } from '@/lib/palette'

export type Fills = Readonly<Record<string, ColorKey>>

export type Artwork = Readonly<{
  id: string
  templateId: string
  templateVersion: number
  fills: Fills
  createdAt: number
  updatedAt: number
}>

export type EditKind = 'fill' | 'erase' | 'clear'

export type HistoryStep = Readonly<{ kind: EditKind; before: Fills; after: Fills }>

export type History = Readonly<{ undo: readonly HistoryStep[]; redo: readonly HistoryStep[] }>

export type LibraryState = Readonly<{
  artworks: Readonly<Record<string, Artwork>>
  /** templateId → artworkId currently being colored for that flower. */
  drafts: Readonly<Record<string, string>>
  /** Explicitly saved artwork, newest first. Autosave never writes this, and never changes these pictures. */
  gallery: readonly Artwork[]
  /** templateId → undo/redo steps for that flower's draft. Saved so they survive leaving the screen. */
  history: Readonly<Record<string, History>>
}>

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const STORAGE_KEYS = Object.freeze({
  artworks: 'lm:v2:artworks',
  drafts: 'lm:v2:drafts',
  gallery: 'lm:v2:gallery',
  history: 'lm:v2:history',
  /** Garden pictures a child took out on this device. Cloud sync deletes their cloud copies. */
  removed: 'lm:v2:removed',
  /** Pictures a grown-up cleared from this device. Cloud sync won't copy them back here. */
  dismissed: 'lm:v2:dismissed',
})

const KEY_LIST = [STORAGE_KEYS.artworks, STORAGE_KEYS.drafts, STORAGE_KEYS.gallery, STORAGE_KEYS.history] as const

/** Per flower, per direction. Keeps the saved history small enough for on-device storage. */
export const MAX_HISTORY = 50

export const MAX_SYNC_MARKS = 1000
const SYNC_MARK_TTL_MS = 180 * 24 * 60 * 60 * 1000

/** A garden picture as stored in the parent's cloud account. */
export type CloudArtwork = Readonly<{
  id: string
  templateId: string
  templateVersion: number
  fills: unknown
  createdAt: number
}>

export type SyncMarks = Readonly<{ removed: readonly string[]; dismissed: readonly string[] }>

const EDIT_KINDS = new Set<string>(['fill', 'erase', 'clear'])

export const EMPTY_FILLS: Fills = Object.freeze({})

export const EMPTY_HISTORY: History = Object.freeze({ undo: Object.freeze([]), redo: Object.freeze([]) })

export const EMPTY_STATE: LibraryState = Object.freeze({
  artworks: Object.freeze({}),
  drafts: Object.freeze({}),
  gallery: Object.freeze([]),
  history: Object.freeze({}),
})

const COLOR_KEYS = new Set<string>(ALL_COLORS.map((c) => c.key))

export function isColorKey(value: unknown): value is ColorKey {
  return typeof value === 'string' && COLOR_KEYS.has(value)
}

export function newArtworkId() {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') return `art_${cryptoApi.randomUUID()}`
  const bytes = new Uint8Array(16)
  cryptoApi.getRandomValues(bytes)
  return `art_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

/** Keeps only approved regions of the pinned version, painted with a real palette color. */
export function sanitizeFills(value: unknown, version: TemplateVersion): Fills {
  if (!isRecord(value)) return EMPTY_FILLS
  const clean: Record<string, ColorKey> = {}
  for (const regionId of version.approvedRegionIds) {
    const color = value[regionId]
    if (isColorKey(color)) clean[regionId] = color
  }
  return Object.freeze(clean)
}

export function selectDraft(state: LibraryState, templateId: string): Artwork | null {
  const id = state.drafts[templateId]
  return id ? (state.artworks[id] ?? null) : null
}

export function selectHistory(state: LibraryState, templateId: string): History {
  return state.history[templateId] ?? EMPTY_HISTORY
}

type LegacyImport = { templateIds: readonly string[]; key: (templateId: string) => string }

type LibraryOptions = {
  storage: () => KeyValueStorage | null
  templates: TemplateSource
  newId?: () => string
  now?: () => number
  /** One-time import of pre-v2 `lm:art:<templateId>` fills, which were all template v1. */
  legacy?: LegacyImport
}

type Write = [key: string, value: unknown]

const SPACE_CHECK_KEY = 'lm:space-check'
/** A kids' page with a full undo history is about 50KB, so this leaves room for one more. */
const PAGE_ROOM_CHARS = 64 * 1024

export type ArtworkLibrary = ReturnType<typeof createArtworkLibrary>

export function createArtworkLibrary({
  storage,
  templates,
  newId = newArtworkId,
  now = Date.now,
  legacy,
}: LibraryOptions) {
  const listeners = new Set<() => void>()
  let lastRaws: (string | null)[] | null = null
  let cached: LibraryState = EMPTY_STATE
  let legacyChecked = false

  const safeStorage = () => {
    try {
      return storage()
    } catch {
      return null
    }
  }

  const notify = () => listeners.forEach((l) => l())

  const readRawMap = (s: KeyValueStorage, key: string): Record<string, unknown> => {
    const value = parseJson(s.getItem(key))
    return isRecord(value) ? { ...value } : {}
  }

  const readRawList = (s: KeyValueStorage, key: string): string[] => {
    const value = parseJson(s.getItem(key))
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  }

  /** `null` removes the key. Artwork records are always written before anything that points at them. */
  const writeRaw = (s: KeyValueStorage, writes: Write[]) => {
    try {
      for (const [key, value] of writes) {
        if (value === null) s.removeItem(key)
        else s.setItem(key, JSON.stringify(value))
      }
      return true
    } catch {
      return false
    }
  }

  /** Set when the device refuses a write (usually full storage) and cleared by the next write that works. */
  let lastWriteFailed = false
  /** Cached result of the space check; any write that works may have changed it, so it is re-checked. */
  let knownFull: boolean | null = null

  const commit = (writes: Write[]) => {
    const s = safeStorage()
    if (!s) return false
    const ok = writeRaw(s, writes)
    lastWriteFailed = !ok
    if (ok) knownFull = null
    notify()
    return ok
  }

  const didLastWriteFail = () => lastWriteFailed

  /** Tries a throwaway write the size of one page's draft and undo history, then removes it. */
  const probeFull = () => {
    const s = safeStorage()
    if (!s) return false
    try {
      s.setItem(SPACE_CHECK_KEY, 'x'.repeat(PAGE_ROOM_CHARS))
      s.removeItem(SPACE_CHECK_KEY)
      return false
    } catch {
      try {
        s.removeItem(SPACE_CHECK_KEY)
      } catch {}
      return true
    }
  }

  /**
   * Whether new coloring can't be saved: the last write was refused, or there isn't room for one
   * more page. Survives reloads, unlike `didLastWriteFail`, so the parent area can warn later.
   */
  const isStorageFull = () => {
    if (lastWriteFailed) return true
    knownFull ??= probeFull()
    return knownFull
  }

  const toArtwork = (id: string, value: unknown): Artwork | null => {
    if (!isRecord(value) || value.id !== id) return null
    const { templateId, templateVersion } = value
    if (typeof templateId !== 'string' || typeof templateVersion !== 'number') return null
    const version = templates.version(templateId, templateVersion)
    if (!version) return null
    return Object.freeze({
      id,
      templateId,
      templateVersion,
      fills: sanitizeFills(value.fills, version),
      createdAt: toNumber(value.createdAt),
      updatedAt: toNumber(value.updatedAt),
    })
  }

  const toSteps = (value: unknown, version: TemplateVersion): readonly HistoryStep[] => {
    if (!Array.isArray(value)) return Object.freeze([])
    const steps: HistoryStep[] = []
    for (const step of value) {
      if (!isRecord(step) || typeof step.kind !== 'string' || !EDIT_KINDS.has(step.kind)) continue
      steps.push(
        Object.freeze({
          kind: step.kind as EditKind,
          before: sanitizeFills(step.before, version),
          after: sanitizeFills(step.after, version),
        }),
      )
    }
    return Object.freeze(steps.slice(-MAX_HISTORY))
  }

  const buildState = ([rawArtworks, rawDrafts, rawGallery, rawHistory]: (string | null)[]): LibraryState => {
    const artworks: Record<string, Artwork> = {}
    const parsedArtworks = parseJson(rawArtworks)
    if (isRecord(parsedArtworks)) {
      for (const [id, value] of Object.entries(parsedArtworks)) {
        const artwork = toArtwork(id, value)
        if (artwork) artworks[id] = artwork
      }
    }

    const drafts: Record<string, string> = {}
    const parsedDrafts = parseJson(rawDrafts)
    if (isRecord(parsedDrafts)) {
      for (const [templateId, id] of Object.entries(parsedDrafts)) {
        if (typeof id === 'string' && artworks[id]?.templateId === templateId) drafts[templateId] = id
      }
    }

    const gallery: Artwork[] = []
    const parsedGallery = parseJson(rawGallery)
    if (Array.isArray(parsedGallery)) {
      const seen = new Set<string>()
      for (const id of parsedGallery) {
        if (typeof id !== 'string' || seen.has(id) || !artworks[id]) continue
        seen.add(id)
        gallery.push(artworks[id])
      }
    }

    const history: Record<string, History> = {}
    const parsedHistory = parseJson(rawHistory)
    if (isRecord(parsedHistory)) {
      for (const [templateId, value] of Object.entries(parsedHistory)) {
        const draft = drafts[templateId] ? artworks[drafts[templateId]] : undefined
        const version = draft && templates.version(draft.templateId, draft.templateVersion)
        if (!version || !isRecord(value)) continue
        history[templateId] = Object.freeze({
          undo: toSteps(value.undo, version),
          redo: toSteps(value.redo, version),
        })
      }
    }

    return Object.freeze({
      artworks: Object.freeze(artworks),
      drafts: Object.freeze(drafts),
      gallery: Object.freeze(gallery),
      history: Object.freeze(history),
    })
  }

  const importLegacy = (s: KeyValueStorage) => {
    if (legacyChecked || !legacy) return
    legacyChecked = true
    for (const templateId of legacy.templateIds) {
      const legacyKey = legacy.key(templateId)
      const raw = s.getItem(legacyKey)
      if (raw === null) continue
      const version = templates.version(templateId, 1)
      const drafts = readRawMap(s, STORAGE_KEYS.drafts)
      const fills = version ? sanitizeFills(parseJson(raw), version) : EMPTY_FILLS
      if (version && !drafts[templateId] && Object.keys(fills).length > 0) {
        const id = newId()
        const t = now()
        const artworks = readRawMap(s, STORAGE_KEYS.artworks)
        artworks[id] = { id, templateId, templateVersion: 1, fills, createdAt: t, updatedAt: t }
        drafts[templateId] = id
        if (!writeRaw(s, [[STORAGE_KEYS.artworks, artworks], [STORAGE_KEYS.drafts, drafts]])) continue
      }
      s.removeItem(legacyKey)
    }
  }

  const getState = (): LibraryState => {
    const s = safeStorage()
    if (!s) return EMPTY_STATE
    try {
      importLegacy(s)
      const raws = KEY_LIST.map((key) => s.getItem(key))
      if (lastRaws && raws.every((raw, i) => raw === lastRaws![i])) return cached
      lastRaws = raws
      cached = buildState(raws)
      return cached
    } catch {
      return EMPTY_STATE
    }
  }

  const getDraft = (templateId: string) => selectDraft(getState(), templateId)

  const inGallery = (state: LibraryState, artworkId: string) => state.gallery.some((a) => a.id === artworkId)

  /**
   * Writes new fills to this flower's draft. Garden pictures are never changed: if the draft is
   * already in the garden, the change goes to a new copy that becomes the draft instead.
   */
  const planDraftWrite = (
    s: KeyValueStorage,
    state: LibraryState,
    templateId: string,
    next: Fills,
    allowCreate: boolean,
  ): { artworkId: string; writes: Write[] } | null => {
    const existing = selectDraft(state, templateId)
    if (!existing && !allowCreate) return null
    const version = existing
      ? templates.version(templateId, existing.templateVersion)
      : templates.latest(templateId)
    if (!version) return null
    const fills = sanitizeFills(next, version)
    const t = now()
    const artworks = readRawMap(s, STORAGE_KEYS.artworks)

    if (existing && !inGallery(state, existing.id)) {
      const record = artworks[existing.id]
      if (!isRecord(record)) return null
      artworks[existing.id] = { ...record, fills, updatedAt: t }
      return { artworkId: existing.id, writes: [[STORAGE_KEYS.artworks, artworks]] }
    }

    const id = newId()
    artworks[id] = { id, templateId, templateVersion: version.version, fills, createdAt: t, updatedAt: t }
    const drafts = readRawMap(s, STORAGE_KEYS.drafts)
    drafts[templateId] = id
    return {
      artworkId: id,
      writes: [
        [STORAGE_KEYS.artworks, artworks],
        [STORAGE_KEYS.drafts, drafts],
      ],
    }
  }

  const historyWrite = (s: KeyValueStorage, templateId: string, history: History | null): Write => {
    const all = readRawMap(s, STORAGE_KEYS.history)
    if (history && (history.undo.length > 0 || history.redo.length > 0)) all[templateId] = history
    else delete all[templateId]
    return [STORAGE_KEYS.history, all]
  }

  /** Applies one edit as a single undoable step. A new edit drops anything that could be redone. */
  const edit = (
    templateId: string,
    kind: EditKind,
    compute: (before: Fills, version: TemplateVersion) => Fills | null,
    allowCreate: boolean,
  ) => {
    const s = safeStorage()
    if (!s) return null
    const state = getState()
    const existing = selectDraft(state, templateId)
    if (!existing && !allowCreate) return null
    const version = existing
      ? templates.version(templateId, existing.templateVersion)
      : templates.latest(templateId)
    if (!version) return null
    const before = existing?.fills ?? EMPTY_FILLS
    const after = compute(before, version)
    if (!after || sameFills(before, after)) return null
    const plan = planDraftWrite(s, state, templateId, after, allowCreate)
    if (!plan) return null
    const past = selectHistory(state, templateId).undo
    const history: History = { undo: [...past, { kind, before, after }].slice(-MAX_HISTORY), redo: [] }
    if (!commit([...plan.writes, historyWrite(s, templateId, history)])) return null
    return { artworkId: plan.artworkId, before }
  }

  /** Colors one region of this flower's draft, starting a new draft (new id, latest version) if needed. */
  const fillRegion = (templateId: string, regionId: string, color: ColorKey) =>
    edit(
      templateId,
      'fill',
      (before, version) =>
        isColorKey(color) && version.approvedRegionIds.includes(regionId) ? { ...before, [regionId]: color } : null,
      true,
    )

  /** Turns one colored region back to white. Never starts a draft. */
  const eraseRegion = (templateId: string, regionId: string) =>
    edit(
      templateId,
      'erase',
      (before) =>
        regionId in before ? Object.fromEntries(Object.entries(before).filter(([id]) => id !== regionId)) : null,
      false,
    )

  /** Start over: every region back to white as one step, so a single Undo brings it all back. */
  const clearDraft = (templateId: string): Fills | null =>
    edit(templateId, 'clear', () => EMPTY_FILLS, false)?.before ?? null

  const travel = (templateId: string, direction: 'undo' | 'redo'): EditKind | null => {
    const s = safeStorage()
    if (!s) return null
    const state = getState()
    const history = selectHistory(state, templateId)
    const step = history[direction].at(-1)
    if (!step) return null
    const plan = planDraftWrite(s, state, templateId, direction === 'undo' ? step.before : step.after, false)
    if (!plan) return null
    const next: History =
      direction === 'undo'
        ? { undo: history.undo.slice(0, -1), redo: [...history.redo, step] }
        : { undo: [...history.undo, step], redo: history.redo.slice(0, -1) }
    return commit([...plan.writes, historyWrite(s, templateId, next)]) ? step.kind : null
  }

  const undo = (templateId: string) => travel(templateId, 'undo')
  const redo = (templateId: string) => travel(templateId, 'redo')

  /**
   * Low-level autosave by id. Update-only: it never creates a record, never touches gallery
   * membership, and refuses garden pictures, so a late save can neither recreate nor alter them.
   */
  const setFills = (artworkId: string, fills: Fills): boolean => {
    const s = safeStorage()
    const state = getState()
    const current = state.artworks[artworkId]
    if (!s || !current || inGallery(state, artworkId)) return false
    const version = templates.version(current.templateId, current.templateVersion)
    if (!version) return false
    const artworks = readRawMap(s, STORAGE_KEYS.artworks)
    const record = artworks[artworkId]
    if (!isRecord(record)) return false
    artworks[artworkId] = { ...record, fills: sanitizeFills(fills, version), updatedAt: now() }
    return commit([[STORAGE_KEYS.artworks, artworks]])
  }

  const saveToGallery = (artworkId: string) => {
    const s = safeStorage()
    if (!s || !getState().artworks[artworkId]) return false
    const gallery = readRawList(s, STORAGE_KEYS.gallery)
    if (gallery.includes(artworkId)) return true
    return commit([[STORAGE_KEYS.gallery, [artworkId, ...gallery]]])
  }

  const gardenPicture = (state: LibraryState, templateId: string, artworkId: string | null | undefined) => {
    const artwork = artworkId ? state.artworks[artworkId] : undefined
    return artwork && artwork.templateId === templateId && inGallery(state, artwork.id) ? artwork : null
  }

  /**
   * Starts a visit to a page. Unsaved coloring from an earlier visit is thrown away, so a page
   * opened from its pack is always white. Given a garden picture of this page, the visit starts
   * with its colors: the draft points at it, so the first change goes to a copy and the garden
   * picture only changes when the child saves.
   */
  const startSession = (templateId: string, gardenArtworkId?: string | null) => {
    const s = safeStorage()
    if (!s) return false
    const state = getState()
    const current = state.drafts[templateId]
    const source = gardenPicture(state, templateId, gardenArtworkId)
    if (!current && !source) return true
    const artworks = readRawMap(s, STORAGE_KEYS.artworks)
    if (current && !inGallery(state, current)) delete artworks[current]
    const drafts = readRawMap(s, STORAGE_KEYS.drafts)
    if (source) drafts[templateId] = source.id
    else delete drafts[templateId]
    return commit([
      [STORAGE_KEYS.drafts, drafts],
      [STORAGE_KEYS.artworks, artworks],
      historyWrite(s, templateId, null),
    ])
  }

  /**
   * Saves this page's coloring to the garden and returns the garden picture's id. With
   * `editingArtworkId` (a garden picture of this page) that picture is updated in place: same spot
   * in the garden, new id, and the old id is marked removed so cloud sync replaces its copy.
   * Otherwise the coloring becomes a new garden picture.
   */
  const saveSession = (templateId: string, editingArtworkId?: string | null): string | null => {
    const s = safeStorage()
    if (!s) return null
    const state = getState()
    const draft = selectDraft(state, templateId)
    if (!draft) return null
    const target = gardenPicture(state, templateId, editingArtworkId)
    if (!target) return saveToGallery(draft.id) ? draft.id : null
    if (draft.id === target.id) return target.id

    const id = newId()
    const artworks = readRawMap(s, STORAGE_KEYS.artworks)
    artworks[id] = {
      id,
      templateId,
      templateVersion: draft.templateVersion,
      fills: draft.fills,
      createdAt: target.createdAt,
      updatedAt: now(),
    }
    if (!inGallery(state, draft.id)) delete artworks[draft.id]
    delete artworks[target.id]
    const gallery = readRawList(s, STORAGE_KEYS.gallery).map((galleryId) => (galleryId === target.id ? id : galleryId))
    const drafts = readRawMap(s, STORAGE_KEYS.drafts)
    drafts[templateId] = id
    const saved = commit([
      [STORAGE_KEYS.artworks, artworks],
      [STORAGE_KEYS.gallery, gallery],
      [STORAGE_KEYS.drafts, drafts],
      markWrite(s, STORAGE_KEYS.removed, [target.id]),
    ])
    return saved ? id : null
  }

  /** Adds ids to a mark list, dropping marks older than the TTL and keeping the newest MAX_SYNC_MARKS. */
  const markWrite = (s: KeyValueStorage, key: string, ids: readonly string[]): Write => {
    const t = now()
    const marks = readRawMap(s, key)
    for (const id of ids) marks[id] = t
    const kept = Object.entries(marks)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && t - entry[1] < SYNC_MARK_TTL_MS)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SYNC_MARKS)
    return [key, Object.fromEntries(kept)]
  }

  const readMarks = (s: KeyValueStorage, key: string) => Object.keys(readRawMap(s, key))

  const syncMarks = (): SyncMarks => {
    const s = safeStorage()
    if (!s) return { removed: [], dismissed: [] }
    try {
      return { removed: readMarks(s, STORAGE_KEYS.removed), dismissed: readMarks(s, STORAGE_KEYS.dismissed) }
    } catch {
      return { removed: [], dismissed: [] }
    }
  }

  /**
   * Drops gallery membership and marks the id as removed, so cloud sync deletes its cloud copy.
   * A finished artwork is deleted. An open draft keeps going under a new id, because the old id
   * can never be saved to the cloud again.
   */
  const removeFromGallery = (artworkId: string) => {
    const s = safeStorage()
    if (!s) return false
    const state = getState()
    const gallery = readRawList(s, STORAGE_KEYS.gallery)
    if (!gallery.includes(artworkId)) return false
    const artworks = readRawMap(s, STORAGE_KEYS.artworks)
    const writes: Write[] = []
    const templateId = Object.keys(state.drafts).find((key) => state.drafts[key] === artworkId)
    const record = artworks[artworkId]
    if (templateId && isRecord(record)) {
      const id = newId()
      artworks[id] = { ...record, id }
      const drafts = readRawMap(s, STORAGE_KEYS.drafts)
      drafts[templateId] = id
      writes.push([STORAGE_KEYS.artworks, { ...artworks }], [STORAGE_KEYS.drafts, drafts])
    }
    delete artworks[artworkId]
    writes.push(
      [STORAGE_KEYS.gallery, gallery.filter((id) => id !== artworkId)],
      [STORAGE_KEYS.artworks, artworks],
      markWrite(s, STORAGE_KEYS.removed, [artworkId]),
    )
    return commit(writes)
  }

  /**
   * Takes pictures that are safe in the parent's account off this device, e.g. at sign-out on a
   * shared device. Nothing is marked, so the cloud copies stay and return when that parent signs
   * in again. An open draft keeps going under a new id so a child's unfinished work stays.
   */
  const forgetOnDevice = (artworkIds: readonly string[]) => {
    const s = safeStorage()
    if (!s || artworkIds.length === 0) return 0
    const gallery = readRawList(s, STORAGE_KEYS.gallery)
    const forget = new Set(artworkIds.filter((id) => gallery.includes(id)))
    if (forget.size === 0) return 0
    const artworks = readRawMap(s, STORAGE_KEYS.artworks)
    const drafts = readRawMap(s, STORAGE_KEYS.drafts)
    for (const [templateId, draftId] of Object.entries(getState().drafts)) {
      const record = artworks[draftId]
      if (!forget.has(draftId) || !isRecord(record)) continue
      const id = newId()
      artworks[id] = { ...record, id }
      drafts[templateId] = id
    }
    for (const id of forget) delete artworks[id]
    return commit([
      [STORAGE_KEYS.gallery, gallery.filter((id) => !forget.has(id))],
      [STORAGE_KEYS.artworks, artworks],
      [STORAGE_KEYS.drafts, drafts],
    ])
      ? forget.size
      : 0
  }

  /**
   * Adds garden pictures saved from the parent's other devices. Skips anything already on this
   * device, taken out here, or cleared here, and anything that doesn't match an approved template.
   */
  const importFromCloud = (records: readonly CloudArtwork[]) => {
    const s = safeStorage()
    if (!s || records.length === 0) return 0
    const state = getState()
    const { removed, dismissed } = syncMarks()
    const skip = new Set([...removed, ...dismissed])
    const artworks = readRawMap(s, STORAGE_KEYS.artworks)
    const added: Artwork[] = []
    for (const record of records) {
      if (skip.has(record.id) || artworks[record.id] || !/^art_[0-9a-f-]{32,36}$/.test(record.id)) continue
      const version = templates.version(record.templateId, record.templateVersion)
      if (!version) continue
      const createdAt = toNumber(record.createdAt)
      const artwork: Artwork = {
        id: record.id,
        templateId: record.templateId,
        templateVersion: record.templateVersion,
        fills: sanitizeFills(record.fills, version),
        createdAt,
        updatedAt: createdAt,
      }
      artworks[record.id] = artwork
      added.push(artwork)
    }
    if (added.length === 0) return 0
    const gallery = [...state.gallery, ...added]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((artwork) => artwork.id)
    return commit([
      [STORAGE_KEYS.artworks, artworks],
      [STORAGE_KEYS.gallery, gallery],
    ])
      ? added.length
      : 0
  }

  /** Lets go of this flower's draft and its undo history, so the next visit starts a fresh artwork. */
  const finishDraft = (templateId: string) => {
    const s = safeStorage()
    const state = getState()
    const artworkId = state.drafts[templateId]
    if (!s || !artworkId) return false
    const drafts = readRawMap(s, STORAGE_KEYS.drafts)
    delete drafts[templateId]
    const writes: Write[] = [[STORAGE_KEYS.drafts, drafts], historyWrite(s, templateId, null)]
    if (!inGallery(state, artworkId)) {
      const artworks = readRawMap(s, STORAGE_KEYS.artworks)
      delete artworks[artworkId]
      writes.push([STORAGE_KEYS.artworks, artworks])
    }
    return commit(writes)
  }

  /**
   * Clears this device only. Cleared garden pictures are marked so sync won't copy them back here;
   * cloud copies stay in the parent's account. Pending cloud removals are kept.
   */
  const clearAll = () => {
    const s = safeStorage()
    const galleryIds = getState().gallery.map((artwork) => artwork.id)
    const writes = KEY_LIST.map((key): Write => [key, null])
    if (s && galleryIds.length > 0) writes.unshift(markWrite(s, STORAGE_KEYS.dismissed, galleryIds))
    return commit(writes)
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || (KEY_LIST as readonly string[]).includes(e.key)) listener()
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
    }
  }

  return {
    templates,
    getState,
    subscribe,
    didLastWriteFail,
    isStorageFull,
    getDraft,
    fillRegion,
    eraseRegion,
    clearDraft,
    undo,
    redo,
    setFills,
    saveToGallery,
    startSession,
    saveSession,
    removeFromGallery,
    finishDraft,
    clearAll,
    syncMarks,
    importFromCloud,
    forgetOnDevice,
  }
}

function sameFills(a: Fills, b: Fills) {
  const aKeys = Object.keys(a)
  return aKeys.length === Object.keys(b).length && aKeys.every((key) => a[key] === b[key])
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
