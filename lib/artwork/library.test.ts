import { describe, expect, it } from 'vitest'
import {
  STORAGE_KEYS,
  createArtworkLibrary,
  selectDraft,
  type KeyValueStorage,
  type LibraryState,
} from '@/lib/artwork/library'
import {
  MANDALAS,
  createTemplateSource,
  defineTemplate,
  freezeOutline,
  freezeVersion,
  type Mandala,
  type TemplateDefinition,
} from '@/lib/mandalas'

/** A device's storage that outlives any one library instance, like localStorage across reloads. */
function createDevice() {
  const data = new Map<string, string>()
  const writes: string[] = []
  const storage: KeyValueStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(key)
      data.set(key, value)
    },
    removeItem: (key) => {
      writes.push(key)
      data.delete(key)
    },
  }
  return { data, writes, storage }
}

type Device = ReturnType<typeof createDevice>

const selectDraftFills = (state: LibraryState) => selectDraft(state, 'rose')?.fills

/** Opening a new library on the same device simulates a page reload: no in-memory state survives. */
function openApp(device: Device, templates: readonly Mandala[] = [roseV1]) {
  return createArtworkLibrary({ storage: () => device.storage, templates: createTemplateSource(templates) })
}

const roseV1Def: TemplateDefinition['versions'][number] = {
  version: 1,
  layers: [{ count: 4, shape: 'round', r0: 40, r1: 450 }],
  centerRadius: 100,
}
const roseV2Def: TemplateDefinition['versions'][number] = {
  version: 2,
  layers: [{ count: 6, shape: 'round', r0: 40, r1: 450 }],
  centerRadius: 100,
}
const roseV1 = defineTemplate({ id: 'rose', name: 'Rose', tier: 'free', versions: [roseV1Def] })
const roseV1AndV2 = defineTemplate({ id: 'rose', name: 'Rose', tier: 'free', versions: [roseV1Def, roseV2Def] })

describe('templates', () => {
  it('are deeply frozen so a published version can never change underneath saved art', () => {
    for (const mandala of MANDALAS) {
      const version = mandala.versions[0]
      expect(Object.isFrozen(mandala.versions)).toBe(true)
      expect(Object.isFrozen(version.regions)).toBe(true)
      expect(Object.isFrozen(version.regions[0])).toBe(true)
      expect(() => (version.approvedRegionIds as string[]).push('sneaky')).toThrow(TypeError)
    }
  })

  it('refuses out-of-order versions and duplicate region ids', () => {
    expect(() => defineTemplate({ id: 'x', name: 'X', tier: 'free', versions: [roseV2Def] })).toThrow(/in order/)
    const petal = { id: 'petal', label: 'Petal' }
    expect(() => freezeVersion('x', 1, [petal, { ...petal, label: 'Copy' }])).toThrow(/duplicate/)
    expect(() => freezeVersion('x', 1, [{ ...petal, label: '' }])).toThrow(/missing/)
  })

  it('refuses an outline with an empty path, or whose areas differ from the page', () => {
    expect(() => freezeOutline('x', 1, [{ id: 'petal', d: ' ' }], [], ['petal'])).toThrow(/missing a path/)
    expect(() => freezeOutline('x', 1, [{ id: 'other', d: 'M 0 0 Z' }], [], ['petal'])).toThrow(/don't match/)
    expect(() => freezeOutline('x', 1, [{ id: 'petal', d: 'M 0 0 Z' }], [], ['petal', 'leaf'])).toThrow(/don't match/)
  })
})

describe('artwork library', () => {
  it('gives every new artwork its own id, even for the same flower', () => {
    const device = createDevice()
    const app = openApp(device)
    const ids = new Set<string>()

    for (let i = 0; i < 5; i++) {
      const result = app.fillRegion('rose', 'center', 'red')!
      ids.add(result.artworkId)
      app.saveToGallery(result.artworkId)
      app.finishDraft('rose')
    }

    expect(ids.size).toBe(5)
    expect([...ids].every((id) => /^art_[0-9a-f-]{32,36}$/.test(id))).toBe(true)
    expect(app.getState().gallery.map((a) => a.id)).toEqual([...ids].reverse())
  })

  it('reports a refused write until the next write succeeds', () => {
    const device = createDevice()
    const app = openApp(device)
    expect(app.didLastWriteFail()).toBe(false)

    const setItem = device.storage.setItem
    device.storage.setItem = () => {
      throw new DOMException('Storage is full', 'QuotaExceededError')
    }
    expect(app.fillRegion('rose', 'center', 'red')).toBeNull()
    expect(app.didLastWriteFail()).toBe(true)

    device.storage.setItem = setItem
    expect(app.fillRegion('rose', 'center', 'red')).not.toBeNull()
    expect(app.didLastWriteFail()).toBe(false)
  })

  it('finds full storage after a reload, when no write has failed yet', () => {
    const device = createDevice()
    expect(openApp(device).isStorageFull()).toBe(false)

    device.storage.setItem = () => {
      throw new DOMException('Storage is full', 'QuotaExceededError')
    }
    const reopened = openApp(device)
    expect(reopened.didLastWriteFail()).toBe(false)
    expect(reopened.isStorageFull()).toBe(true)
    expect(device.data.has('lm:space-check')).toBe(false)
  })

  it('does not create an artwork just by opening a flower', () => {
    const device = createDevice()
    const app = openApp(device)
    expect(app.getDraft('rose')).toBeNull()
    expect(device.writes).toEqual([])
  })

  it('only accepts approved regions and palette colors, and scrubs tampered storage', () => {
    const device = createDevice()
    const app = openApp(device)

    expect(app.fillRegion('rose', 'not-a-region', 'red')).toBeNull()
    expect(app.fillRegion('rose', 'center', 'chartreuse' as 'red')).toBeNull()
    expect(app.getState().artworks).toEqual({})

    const { artworkId } = app.fillRegion('rose', 'l0-p0', 'blue')!
    const raw = JSON.parse(device.data.get(STORAGE_KEYS.artworks)!)
    raw[artworkId].fills = { 'l0-p0': 'blue', 'l0-p1': 'chartreuse', injected: 'red' }
    device.data.set(STORAGE_KEYS.artworks, JSON.stringify(raw))

    expect(openApp(device).getDraft('rose')?.fills).toEqual({ 'l0-p0': 'blue' })
  })

  it('keeps an autosaved draft across a reload', () => {
    const device = createDevice()
    const first = openApp(device)
    const { artworkId } = first.fillRegion('rose', 'l0-p0', 'red')!
    first.fillRegion('rose', 'center', 'yellow')

    const reloaded = openApp(device)
    const draft = reloaded.getDraft('rose')
    expect(draft?.id).toBe(artworkId)
    expect(draft?.fills).toEqual({ 'l0-p0': 'red', center: 'yellow' })
  })

  it('pins a draft to the template version it started on, even after a new version ships', () => {
    const device = createDevice()
    const { artworkId } = openApp(device, [roseV1]).fillRegion('rose', 'l0-p0', 'red')!

    const afterUpdate = openApp(device, [roseV1AndV2])
    expect(afterUpdate.getDraft('rose')).toMatchObject({ id: artworkId, templateVersion: 1 })
    expect(afterUpdate.fillRegion('rose', 'l0-p5', 'blue')).toBeNull()

    afterUpdate.finishDraft('rose')
    const fresh = afterUpdate.fillRegion('rose', 'l0-p5', 'blue')!
    expect(fresh.artworkId).not.toBe(artworkId)
    expect(afterUpdate.getDraft('rose')?.templateVersion).toBe(2)
  })

  it('starts a page white, throwing away unsaved coloring from the last visit', () => {
    const device = createDevice()
    const app = openApp(device)
    const { artworkId } = app.fillRegion('rose', 'l0-p0', 'red')!

    const next = openApp(device)
    expect(next.startSession('rose')).toBe(true)
    expect(next.getDraft('rose')).toBeNull()
    expect(next.undo('rose')).toBeNull()
    expect(next.getState().artworks[artworkId]).toBeUndefined()
  })

  it('saving a new picture adds it to the garden, and the next visit from the pack is white', () => {
    const device = createDevice()
    const app = openApp(device)
    app.startSession('rose')
    app.fillRegion('rose', 'l0-p0', 'red')
    const savedId = app.saveSession('rose')!
    app.finishDraft('rose')

    const next = openApp(device)
    next.startSession('rose')
    expect(next.getDraft('rose')).toBeNull()
    expect(next.getState().gallery.map((a) => a.id)).toEqual([savedId])
    expect(next.getState().gallery[0].fills).toEqual({ 'l0-p0': 'red' })
  })

  it('opens a garden picture with its colors and leaves it unchanged unless saved', () => {
    const device = createDevice()
    const app = openApp(device)
    app.fillRegion('rose', 'l0-p0', 'red')
    const savedId = app.saveSession('rose')!
    app.finishDraft('rose')

    const visit = openApp(device)
    visit.startSession('rose', savedId)
    expect(visit.getDraft('rose')?.fills).toEqual({ 'l0-p0': 'red' })
    visit.fillRegion('rose', 'l0-p1', 'blue')
    visit.finishDraft('rose')

    const after = openApp(device)
    expect(after.getState().gallery.map((a) => a.fills)).toEqual([{ 'l0-p0': 'red' }])
    expect(Object.keys(after.getState().artworks)).toEqual([savedId])
  })

  it('saving a garden picture updates it in its spot and marks the old copy for cloud removal', () => {
    const device = createDevice()
    const app = openApp(device)
    app.fillRegion('rose', 'l0-p0', 'red')
    const first = app.saveSession('rose')!
    app.finishDraft('rose')
    app.fillRegion('rose', 'l0-p2', 'green')
    const second = app.saveSession('rose')!
    app.finishDraft('rose')
    const firstCreatedAt = app.getState().artworks[first].createdAt

    app.startSession('rose', first)
    app.fillRegion('rose', 'l0-p1', 'blue')
    const updated = app.saveSession('rose', first)!

    const state = openApp(device).getState()
    expect(updated).not.toBe(first)
    expect(state.gallery.map((a) => a.id)).toEqual([second, updated])
    expect(state.artworks[updated].fills).toEqual({ 'l0-p0': 'red', 'l0-p1': 'blue' })
    expect(state.artworks[updated].createdAt).toBe(firstCreatedAt)
    expect(state.artworks[first]).toBeUndefined()
    expect(openApp(device).syncMarks().removed).toEqual([first])

    app.fillRegion('rose', 'l0-p3', 'yellow')
    const again = app.saveSession('rose', updated)!
    expect(openApp(device).getState().gallery.map((a) => a.id)).toEqual([second, again])
  })

  it('ignores a garden id from another page and starts white', () => {
    const device = createDevice()
    const app = openApp(device)
    app.fillRegion('rose', 'l0-p0', 'red')
    const roseId = app.saveSession('rose')!
    app.finishDraft('rose')

    expect(app.startSession('daisy', roseId)).toBe(true)
    expect(app.getDraft('daisy')).toBeNull()
  })

  it('never writes gallery membership while autosaving', () => {
    const device = createDevice()
    const app = openApp(device)
    app.fillRegion('rose', 'l0-p0', 'red')
    app.fillRegion('rose', 'l0-p1', 'green')

    expect(device.writes).not.toContain(STORAGE_KEYS.gallery)
    expect(app.getState().gallery).toEqual([])
  })

  it('does not bring back a removed gallery entry when the open draft keeps autosaving', () => {
    const device = createDevice()
    const app = openApp(device)
    const { artworkId } = app.fillRegion('rose', 'l0-p0', 'red')!
    app.saveToGallery(artworkId)
    expect(app.removeFromGallery(artworkId)).toBe(true)

    app.fillRegion('rose', 'l0-p1', 'green')
    app.fillRegion('rose', 'center', 'purple')

    expect(app.getState().gallery).toEqual([])
    expect(openApp(device).getState().gallery).toEqual([])
    expect(openApp(device).getDraft('rose')?.fills).toEqual({ 'l0-p0': 'red', 'l0-p1': 'green', center: 'purple' })
  })

  it('deletes a finished artwork when it is removed, and a late save cannot recreate it', () => {
    const device = createDevice()
    const app = openApp(device)
    const { artworkId } = app.fillRegion('rose', 'l0-p0', 'red')!
    app.saveToGallery(artworkId)
    app.finishDraft('rose')
    app.removeFromGallery(artworkId)

    expect(app.setFills(artworkId, { 'l0-p0': 'blue' })).toBe(false)
    expect(app.saveToGallery(artworkId)).toBe(false)

    const reloaded = openApp(device)
    expect(reloaded.getState().artworks[artworkId]).toBeUndefined()
    expect(reloaded.getState().gallery).toEqual([])
  })

  it('takes account pictures off the device at sign-out, keeps unfinished work, and lets them come back', () => {
    const device = createDevice()
    const app = openApp(device)
    const finished = app.fillRegion('rose', 'l0-p0', 'red')!.artworkId
    app.saveToGallery(finished)
    app.finishDraft('rose')
    const stillOpen = app.fillRegion('rose', 'l0-p1', 'green')!.artworkId
    app.saveToGallery(stillOpen)

    expect(app.forgetOnDevice([finished, stillOpen, 'art_not_here'])).toBe(2)

    const reloaded = openApp(device)
    expect(reloaded.getState().gallery).toEqual([])
    expect(reloaded.getState().artworks[finished]).toBeUndefined()
    expect(reloaded.getDraft('rose')?.fills).toEqual({ 'l0-p1': 'green' })
    expect(reloaded.getDraft('rose')?.id).not.toBe(stillOpen)
    expect(reloaded.syncMarks()).toEqual({ removed: [], dismissed: [] })

    const cloudCopy = { id: finished, templateId: 'rose', templateVersion: 1, fills: { 'l0-p0': 'red' }, createdAt: 1 }
    expect(reloaded.importFromCloud([cloudCopy])).toBe(1)
    expect(reloaded.getState().gallery.map((artwork) => artwork.id)).toEqual([finished])
  })

  it('erases one region without starting a draft on a blank flower', () => {
    const device = createDevice()
    const app = openApp(device)
    expect(app.eraseRegion('rose', 'center')).toBeNull()
    expect(device.writes).toEqual([])

    app.fillRegion('rose', 'l0-p0', 'red')
    app.fillRegion('rose', 'center', 'blue')
    expect(app.eraseRegion('rose', 'l0-p1')).toBeNull()
    expect(app.eraseRegion('rose', 'center')).not.toBeNull()
    expect(app.getDraft('rose')?.fills).toEqual({ 'l0-p0': 'red' })
  })

  it('undoes and redoes step by step, and a new edit drops the redo steps', () => {
    const app = openApp(createDevice())
    app.fillRegion('rose', 'l0-p0', 'red')
    app.fillRegion('rose', 'l0-p1', 'green')
    app.clearDraft('rose')

    expect(app.undo('rose')).toBe('clear')
    expect(app.getDraft('rose')?.fills).toEqual({ 'l0-p0': 'red', 'l0-p1': 'green' })
    expect(app.undo('rose')).toBe('fill')
    expect(app.getDraft('rose')?.fills).toEqual({ 'l0-p0': 'red' })
    expect(app.redo('rose')).toBe('fill')
    expect(app.getDraft('rose')?.fills).toEqual({ 'l0-p0': 'red', 'l0-p1': 'green' })

    app.fillRegion('rose', 'center', 'yellow')
    expect(app.redo('rose')).toBeNull()
    expect(app.getState().history.rose.undo).toHaveLength(3)
  })

  it('keeps undo history across a reload and forgets it when the flower is finished', () => {
    const device = createDevice()
    const first = openApp(device)
    first.fillRegion('rose', 'l0-p0', 'red')
    first.clearDraft('rose')

    const reloaded = openApp(device)
    expect(reloaded.undo('rose')).toBe('clear')
    expect(reloaded.getDraft('rose')?.fills).toEqual({ 'l0-p0': 'red' })

    reloaded.finishDraft('rose')
    expect(openApp(device).getState().history).toEqual({})
    expect(device.data.get(STORAGE_KEYS.history)).toBe('{}')
  })

  it('scrubs tampered history down to approved regions and known steps', () => {
    const device = createDevice()
    openApp(device).fillRegion('rose', 'l0-p0', 'red')
    device.data.set(
      STORAGE_KEYS.history,
      JSON.stringify({
        rose: {
          undo: [
            { kind: 'fill', before: { injected: 'red', 'l0-p1': 'teal' }, after: { 'l0-p0': 'red' } },
            { kind: 'delete-everything', before: {}, after: {} },
          ],
          redo: 'nope',
        },
        ghost: { undo: [{ kind: 'fill', before: {}, after: {} }], redo: [] },
      }),
    )

    const { history } = openApp(device).getState()
    expect(Object.keys(history)).toEqual(['rose'])
    expect(history.rose.undo).toEqual([{ kind: 'fill', before: {}, after: { 'l0-p0': 'red' } }])
    expect(history.rose.redo).toEqual([])
  })

  it('never changes a garden picture: edits, clears, and undo continue on a new copy', () => {
    const device = createDevice()
    const app = openApp(device)
    const { artworkId: savedId } = app.fillRegion('rose', 'l0-p0', 'red')!
    app.saveToGallery(savedId)

    const next = app.fillRegion('rose', 'center', 'blue')!
    expect(next.artworkId).not.toBe(savedId)
    expect(app.getState().artworks[savedId].fills).toEqual({ 'l0-p0': 'red' })
    expect(app.getDraft('rose')).toMatchObject({ id: next.artworkId, templateVersion: 1 })

    app.saveToGallery(next.artworkId)
    app.clearDraft('rose')
    app.undo('rose')
    app.undo('rose')
    expect(app.setFills(savedId, {})).toBe(false)

    const reloaded = openApp(device).getState()
    expect(reloaded.gallery.map((a) => a.fills)).toEqual([{ 'l0-p0': 'red', center: 'blue' }, { 'l0-p0': 'red' }])
    expect(selectDraftFills(reloaded)).toEqual({ 'l0-p0': 'red' })
  })

  it('imports pre-versioning art once and removes the old key', () => {
    const device = createDevice()
    device.data.set('lm:art:rose', JSON.stringify({ center: 'orange', bogus: 'red' }))
    const app = createArtworkLibrary({
      storage: () => device.storage,
      templates: createTemplateSource([roseV1]),
      legacy: { templateIds: ['rose'], key: (id) => `lm:art:${id}` },
    })

    expect(app.getDraft('rose')).toMatchObject({ templateVersion: 1, fills: { center: 'orange' } })
    expect(device.data.has('lm:art:rose')).toBe(false)
  })
})
