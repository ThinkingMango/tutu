// @vitest-environment node
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, expect, it } from 'vitest'
import { createArtworkLibrary, type KeyValueStorage } from '@/lib/artwork/library'
import { createCloudSync, summarizeSync } from '@/lib/cloud-sync/engine'
import { templates } from '@/lib/mandalas'

const EMAIL = 'qa-parent-a@littlemandala-qa.test'
const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function device() {
  const data = new Map<string, string>()
  const storage: KeyValueStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
  return createArtworkLibrary({ storage: () => storage, templates })
}

function paint(library: ReturnType<typeof device>, templateId: string) {
  const { artworkId } = library.fillRegion(templateId, 'center', 'red')!
  library.saveToGallery(artworkId)
  library.finishDraft(templateId)
  return artworkId
}

let parent: SupabaseClient
let userId = ''

async function cleanup() {
  if (!parent || !userId) return
  await parent.rpc('disable_cloud_saving')
  const bucket = parent.storage.from('artwork')
  const { data } = await bucket.list(userId, { limit: 100 })
  if (data?.length) await bucket.remove(data.map((file) => `${userId}/${file.name}`))
}

afterAll(cleanup, 60_000)

it('syncs garden pictures through real Supabase rules', async () => {
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL })
  if (link.error) throw link.error
  parent = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const verified = await parent.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' })
  if (verified.error) throw verified.error
  userId = verified.data.user!.id
  await cleanup()

  const tabletA = device()
  const first = paint(tabletA, 'sunny')
  const second = paint(tabletA, 'daisy')
  const syncA = createCloudSync({ library: tabletA, client: () => parent })

  syncA.setParent(userId)
  await syncA.whenIdle()
  const offSummary = summarizeSync(syncA.getSnapshot(), tabletA.getState().gallery)
  console.log('[live] before consent:', offSummary.state)
  expect(offSummary.state).toBe('off')
  expect((await parent.from('artworks').select('id')).data).toEqual([])

  const consent = await parent.rpc('give_cloud_consent', { p_notice_version: 1 })
  if (consent.error) throw consent.error
  await syncA.syncNow()
  const onSummary = summarizeSync(syncA.getSnapshot(), tabletA.getState().gallery)
  console.log('[live] after consent:', JSON.stringify(onSummary), syncA.getSnapshot().detail ?? '')
  expect(onSummary.state).toBe('synced')

  const rows = (await parent.from('artworks').select('id, file_path')).data ?? []
  expect(rows.map((row) => row.id).sort()).toEqual([first, second].sort())
  const files = (await parent.storage.from('artwork').list(userId)).data ?? []
  expect(files.map((file) => file.name).sort()).toEqual([`${first}.svg`, `${second}.svg`].sort())
  const download = await parent.storage.from('artwork').download(`${userId}/${first}.svg`)
  expect(await download.data!.text()).toContain('<svg')

  const tabletB = device()
  const syncB = createCloudSync({ library: tabletB, client: () => parent })
  syncB.setParent(userId)
  await syncB.whenIdle()
  const onB = tabletB.getState().gallery.map((artwork) => artwork.id).sort()
  console.log('[live] second device gallery:', onB.length)
  expect(onB).toEqual([first, second].sort())

  tabletA.removeFromGallery(first)
  await syncA.syncNow()
  const afterRemove = (await parent.from('artworks').select('id')).data ?? []
  expect(afterRemove.map((row) => row.id)).toEqual([second])
  const filesAfter = (await parent.storage.from('artwork').list(userId)).data ?? []
  expect(filesAfter.map((file) => file.name)).toEqual([`${second}.svg`])
  const reinsert = await parent.from('artworks').insert({
    id: first,
    parent_id: userId,
    template_id: 'sunny',
    template_version: 1,
    fills: {},
    file_path: `${userId}/${first}.svg`,
  })
  console.log('[live] re-adding a removed picture:', reinsert.error?.code ?? 'accepted')
  expect(reinsert.error).not.toBeNull()

  await syncB.syncNow()
  const onBAfter = tabletB.getState().gallery.map((artwork) => artwork.id).sort()
  const summaryB = summarizeSync(syncB.getSnapshot(), tabletB.getState().gallery)
  console.log('[live] second device after removal:', JSON.stringify(summaryB))
  expect(onBAfter).toEqual([first, second].sort())
  expect(summaryB).toMatchObject({ state: 'synced', total: 1, saved: 1, waiting: 0, removedElsewhere: 1 })
  expect((await parent.from('artworks').select('id')).data?.map((row) => row.id)).toEqual([second])

  const stranger = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const strangerRows = await stranger.from('artworks').select('id')
  console.log('[live] signed-out artwork query:', strangerRows.error?.code ?? `${strangerRows.data?.length} rows`)
  expect(strangerRows.data ?? []).toEqual([])
  const strangerFile = await stranger.storage.from('artwork').download(`${userId}/${second}.svg`)
  console.log('[live] signed-out download blocked:', Boolean(strangerFile.error))
  expect(strangerFile.error).not.toBeNull()

  syncA.setParent(null)
  syncB.setParent(null)
}, 120_000)
