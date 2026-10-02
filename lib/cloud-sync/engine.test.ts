import { afterEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { STORAGE_KEYS, createArtworkLibrary, type KeyValueStorage } from '@/lib/artwork/library'
import { renderArtworkSvg } from '@/lib/cloud-sync/artwork-svg'
import { peekOutline } from '@/lib/templates/outlines'
import { createCloudSync, summarizeSync, type CloudSync } from '@/lib/cloud-sync/engine'
import { templates } from '@/lib/mandalas'

const PARENT = '11111111-1111-4111-8111-111111111111'
const NETWORK_ERROR = { message: 'TypeError: Failed to fetch' }

type Row = { id: string; template_id: string; template_version: number; fills: unknown; created_at: string }

/** One parent's cloud account, enforcing the same rules as the database and storage policies. */
function createCloud() {
  const db = {
    consent: true,
    offline: false,
    failNextUploads: 0,
    rows: new Map<string, Row>(),
    tombstones: new Set<string>(),
    files: new Map<string, { createdAt: number; body: string }>(),
  }
  const idFromPath = (path: string) => path.split('/')[1].replace(/\.svg$/, '')
  const offline = <T>(value: T) => (db.offline ? { data: null, error: NETWORK_ERROR } : value)

  const client = {
    rpc: async () => offline({ data: db.consent, error: null }),
    from(table: 'artworks' | 'artwork_deletions') {
      return {
        select() {
          const query = {
            eq: () => query,
            limit: async () =>
              offline({
                data:
                  table === 'artworks'
                    ? [...db.rows.values()]
                    : [...db.tombstones].map((artwork_id) => ({ artwork_id })),
                error: null,
              }),
          }
          return query
        },
        async insert(row: Row & { parent_id: string; file_path: string }) {
          if (db.offline) return { error: NETWORK_ERROR }
          if (!db.consent || db.tombstones.has(row.id) || row.parent_id !== PARENT) {
            return { error: { code: '42501', message: 'new row violates row-level security policy' } }
          }
          if (db.rows.has(row.id)) return { error: { code: '23505', message: 'duplicate key' } }
          db.rows.set(row.id, row)
          return { error: null }
        },
        delete: () => ({
          eq: () => ({
            in: async (_column: string, ids: string[]) => {
              for (const id of ids) if (db.rows.delete(id)) db.tombstones.add(id)
              return { error: null }
            },
          }),
        }),
      }
    },
    storage: {
      from: () => ({
        list: async () =>
          offline({
            data: [...db.files].map(([id, file]) => ({
              name: `${id}.svg`,
              created_at: new Date(file.createdAt).toISOString(),
            })),
            error: null,
          }),
        async upload(path: string, blob: Blob) {
          if (db.offline) return { error: NETWORK_ERROR }
          if (db.failNextUploads > 0) {
            db.failNextUploads -= 1
            return { error: { message: 'Internal error', statusCode: '500' } }
          }
          if (!db.consent) return { error: { message: 'row-level security', statusCode: '403' } }
          const id = idFromPath(path)
          if (db.files.has(id)) return { error: { message: 'The resource already exists', statusCode: '409' } }
          db.files.set(id, { createdAt: Date.now(), body: await blob.text() })
          return { error: null }
        },
        async remove(paths: string[]) {
          for (const path of paths) db.files.delete(idFromPath(path))
          return { error: null }
        },
      }),
    },
  }
  return { db, client: client as unknown as SupabaseClient }
}

function createDevice() {
  const data = new Map<string, string>()
  const storage: KeyValueStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
  const library = createArtworkLibrary({ storage: () => storage, templates })
  return { data, library }
}

type Device = ReturnType<typeof createDevice>

const engines: CloudSync[] = []

function connect(device: Device, cloud: ReturnType<typeof createCloud>) {
  const sync = createCloudSync({ library: device.library, client: () => cloud.client })
  engines.push(sync)
  return sync
}

async function signIn(sync: CloudSync) {
  sync.setParent(PARENT)
  await sync.whenIdle()
}

function paintAndSave(device: Device, templateId = 'sunny', color: 'red' | 'blue' = 'red') {
  const { artworkId } = device.library.fillRegion(templateId, 'center', color)!
  device.library.saveToGallery(artworkId)
  device.library.finishDraft(templateId)
  return artworkId
}

const summary = (sync: CloudSync, device: Device) =>
  summarizeSync(sync.getSnapshot(), device.library.getState().gallery)

afterEach(() => {
  for (const sync of engines.splice(0)) sync.setParent(null)
})

describe('cloud sync', () => {
  it('uploads nothing and reports "off" without consent', async () => {
    const cloud = createCloud()
    cloud.db.consent = false
    const device = createDevice()
    paintAndSave(device)
    const sync = connect(device, cloud)

    await signIn(sync)

    expect(cloud.db.rows.size).toBe(0)
    expect(cloud.db.files.size).toBe(0)
    expect(summary(sync, device).state).toBe('off')
  })

  it('copies every garden picture, including ones saved before cloud saving was on', async () => {
    const cloud = createCloud()
    const device = createDevice()
    const first = paintAndSave(device, 'sunny')
    const second = paintAndSave(device, 'daisy', 'blue')
    device.library.fillRegion('lotus', 'center', 'red')
    const sync = connect(device, cloud)

    await signIn(sync)

    expect([...cloud.db.rows.keys()].sort()).toEqual([first, second].sort())
    expect([...cloud.db.files.keys()].sort()).toEqual([first, second].sort())
    expect(cloud.db.rows.get(first)).toMatchObject({ template_id: 'sunny', template_version: 1, fills: { center: 'red' } })
    expect(summary(sync, device)).toMatchObject({ state: 'synced', total: 2, saved: 2, waiting: 0 })
  })

  it('stores an image file that matches the picture', async () => {
    const cloud = createCloud()
    const device = createDevice()
    const id = paintAndSave(device, 'sunny')
    await signIn(connect(device, cloud))

    const artwork = device.library.getState().artworks[id]
    const version = templates.version('sunny', 1)!
    const expected = renderArtworkSvg(version, peekOutline(version)!, artwork.fills)
    expect(cloud.db.files.get(id)?.body).toBe(expected)
    expect(expected).toContain('fill="#f54748"')
    expect(expected).not.toContain('var(')
  })

  it('reports failed uploads honestly and finishes them on the next try', async () => {
    const cloud = createCloud()
    cloud.db.failNextUploads = 1
    const device = createDevice()
    paintAndSave(device, 'sunny')
    paintAndSave(device, 'daisy')
    const sync = connect(device, cloud)

    await signIn(sync)
    expect(summary(sync, device)).toMatchObject({ state: 'waiting', total: 2, saved: 1, waiting: 1 })

    await sync.syncNow()
    expect(summary(sync, device)).toMatchObject({ state: 'synced', saved: 2 })
    expect(cloud.db.rows.size).toBe(2)
  })

  it('says offline instead of synced when the cloud cannot be reached', async () => {
    const cloud = createCloud()
    cloud.db.offline = true
    const device = createDevice()
    paintAndSave(device)
    const sync = connect(device, cloud)

    await signIn(sync)
    expect(summary(sync, device).state).toBe('offline')
  })

  it('finishes a half-done upload where the file landed but the row did not', async () => {
    const cloud = createCloud()
    const device = createDevice()
    const id = paintAndSave(device)
    cloud.db.files.set(id, { createdAt: Date.now() - 60 * 60 * 1000, body: '<svg/>' })

    const sync = connect(device, cloud)
    await signIn(sync)

    expect(cloud.db.rows.has(id)).toBe(true)
    expect(summary(sync, device).state).toBe('synced')
  })

  it('removes the cloud copy when a child takes a picture out, and a stale device cannot bring it back', async () => {
    const cloud = createCloud()
    const tablet = createDevice()
    const id = paintAndSave(tablet)
    const tabletSync = connect(tablet, cloud)
    await signIn(tabletSync)

    const phone = createDevice()
    const phoneSync = connect(phone, cloud)
    await signIn(phoneSync)
    expect(phone.library.getState().gallery.map((a) => a.id)).toEqual([id])

    tablet.library.removeFromGallery(id)
    await tabletSync.syncNow()
    expect(cloud.db.rows.has(id)).toBe(false)
    expect(cloud.db.files.has(id)).toBe(false)
    expect(cloud.db.tombstones.has(id)).toBe(true)

    await phoneSync.syncNow()
    expect(cloud.db.rows.has(id)).toBe(false)
    expect(summarizeSync(phoneSync.getSnapshot(), phone.library.getState().gallery)).toMatchObject({
      state: 'synced',
      total: 0,
      removedElsewhere: 1,
    })
  })

  it('keeps an open draft going under a new id when its garden copy is taken out', async () => {
    const cloud = createCloud()
    const device = createDevice()
    const { artworkId } = device.library.fillRegion('sunny', 'center', 'red')!
    device.library.saveToGallery(artworkId)
    const sync = connect(device, cloud)
    await signIn(sync)

    device.library.removeFromGallery(artworkId)
    const draft = device.library.getDraft('sunny')!
    expect(draft.id).not.toBe(artworkId)
    expect(draft.fills).toEqual({ center: 'red' })

    device.library.saveToGallery(draft.id)
    await sync.syncNow()
    expect(cloud.db.rows.has(draft.id)).toBe(true)
    expect(cloud.db.rows.has(artworkId)).toBe(false)
  })

  it('brings pictures from other devices into the garden, but not ones cleared from this device', async () => {
    const cloud = createCloud()
    const tablet = createDevice()
    const first = paintAndSave(tablet, 'sunny')
    const second = paintAndSave(tablet, 'daisy')
    await signIn(connect(tablet, cloud))

    const phone = createDevice()
    const phoneSync = connect(phone, cloud)
    await signIn(phoneSync)
    expect(new Set(phone.library.getState().gallery.map((a) => a.id))).toEqual(new Set([first, second]))

    phone.library.clearAll()
    await phoneSync.syncNow()
    expect(phone.library.getState().gallery).toEqual([])
    expect(cloud.db.rows.size).toBe(2)
    expect(JSON.parse(phone.data.get(STORAGE_KEYS.dismissed)!)).toHaveProperty(first)
  })

  it('still deletes the cloud copy if the device is cleared before the removal synced', async () => {
    const cloud = createCloud()
    const device = createDevice()
    const id = paintAndSave(device)
    const sync = connect(device, cloud)
    await signIn(sync)

    sync.setParent(null)
    device.library.removeFromGallery(id)
    device.library.clearAll()
    await signIn(sync)

    expect(cloud.db.rows.has(id)).toBe(false)
    expect(cloud.db.files.has(id)).toBe(false)
  })

  it('stops uploading once cloud saving is turned off', async () => {
    const cloud = createCloud()
    const device = createDevice()
    const sync = connect(device, cloud)
    await signIn(sync)

    await sync.pause()
    cloud.db.consent = false
    cloud.db.rows.clear()
    paintAndSave(device)
    await sync.syncNow()
    expect(cloud.db.files.size).toBe(0)

    await sync.resume()
    expect(cloud.db.files.size).toBe(0)
    expect(summary(sync, device).state).toBe('off')
  })
})
