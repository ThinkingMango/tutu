// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } }
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, clientOptions)
const stamp = `${Date.now()}`

type Parent = {
  label: 'A' | 'B'
  id: string
  email: string
  client: SupabaseClient
  customerId: string
  subscriptionId: string
  transactionId: string
  keptArtwork: string
  removedArtwork: string
}

/** Tables a parent can read, and the column that says whose row it is. */
const OWNED_TABLES = [
  { table: 'profiles', owner: 'id' },
  { table: 'consent_records', owner: 'parent_id' },
  { table: 'artworks', owner: 'parent_id' },
  { table: 'artwork_deletions', owner: 'parent_id' },
  { table: 'billing_customers', owner: 'parent_id' },
  { table: 'entitlements', owner: 'parent_id' },
] as const
const CUSTOMER_TABLES = ['subscriptions', 'transactions'] as const
const svg = () => new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' })
const filePath = (parent: Parent, artworkId: string) => `${parent.id}/${artworkId}.svg`
const logDenial = (attempt: string, error: { code?: string; message: string } | null) =>
  console.log(`[live] ${attempt}: ${error ? `${error.code ?? '-'} ${error.message}` : 'ALLOWED'}`)

async function signIn(label: 'A' | 'B') {
  const email = `lm-verify-iso-${label.toLowerCase()}-${stamp}@example.com`
  const created = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (created.error) throw created.error
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error) throw link.error
  const client = createClient(url, anonKey, clientOptions)
  const verified = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' })
  if (verified.error) throw verified.error
  return { id: created.data.user.id, email, client }
}

async function uploadArtwork(parent: Pick<Parent, 'id' | 'client'>, templateId: string) {
  const id = `art_${randomUUID()}`
  const path = `${parent.id}/${id}.svg`
  const upload = await parent.client.storage.from('artwork').upload(path, svg(), { contentType: 'image/svg+xml' })
  if (upload.error) throw upload.error
  const row = await parent.client.from('artworks').insert({
    id,
    parent_id: parent.id,
    template_id: templateId,
    template_version: 1,
    fills: { center: 'red' },
    file_path: path,
    created_at: new Date().toISOString(),
  })
  if (row.error) throw row.error
  return id
}

async function createParent(label: 'A' | 'B', noticeVersion: number): Promise<Parent> {
  const { id, email, client } = await signIn(label)
  const consent = await client.rpc('give_cloud_consent', { p_notice_version: noticeVersion })
  if (consent.error) throw consent.error

  const keptArtwork = await uploadArtwork({ id, client }, 'sunny')
  const removedArtwork = await uploadArtwork({ id, client }, 'daisy')
  const removed = await client.from('artworks').delete().eq('id', removedArtwork)
  if (removed.error) throw removed.error
  await client.storage.from('artwork').remove([`${id}/${removedArtwork}.svg`])

  const tag = `iso${label.toLowerCase()}${stamp}`
  const customerId = `cus_${tag}`
  const subscriptionId = `sub_${tag}`
  const transactionId = `cs_test_${tag}`
  const now = new Date().toISOString()
  const seeds = [
    await admin.from('billing_customers').insert({ parent_id: id, stripe_customer_id: customerId }),
    await admin.from('subscriptions').insert({
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      status: 'active',
      price_id: 'price_isolationtest',
      current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      last_event_at: now,
    }),
    await admin.from('transactions').insert({
      stripe_checkout_session_id: transactionId,
      stripe_customer_id: customerId,
      pack_ids: ['ocean-friends'],
      amount_minor: 499,
      currency: 'USD',
      status: 'paid',
      occurred_at: now,
    }),
    await admin.from('entitlements').insert({
      parent_id: id,
      scope: 'pack',
      pack_id: 'ocean-friends',
      source_type: 'transaction',
      source_id: transactionId,
    }),
  ]
  const failed = seeds.find((result) => result.error)
  if (failed?.error) throw failed.error

  return { label, id, email, client, customerId, subscriptionId, transactionId, keptArtwork, removedArtwork }
}

/** What the database really holds for a parent, read with full access. */
async function adminSnapshot(parent: Parent) {
  const count = async (table: string, column: string, value: string) => {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq(column, value)
    if (error) throw error
    return count ?? 0
  }
  const files = await admin.storage.from('artwork').list(parent.id)
  return {
    profiles: await count('profiles', 'id', parent.id),
    consent: await count('consent_records', 'parent_id', parent.id),
    activeConsent: (
      await admin.from('consent_records').select('id').eq('parent_id', parent.id).is('withdrawn_at', null)
    ).data?.length,
    artworks: await count('artworks', 'parent_id', parent.id),
    deletions: await count('artwork_deletions', 'parent_id', parent.id),
    customers: await count('billing_customers', 'parent_id', parent.id),
    subscriptions: await count('subscriptions', 'stripe_customer_id', parent.customerId),
    transactions: await count('transactions', 'stripe_customer_id', parent.customerId),
    entitlements: await count('entitlements', 'parent_id', parent.id),
    files: (files.data ?? []).map((file) => file.name).sort(),
  }
}

let a: Parent
let b: Parent
let bBefore: Awaited<ReturnType<typeof adminSnapshot>>

beforeAll(async () => {
  const notice = await admin
    .from('consent_notices')
    .select('version')
    .eq('purpose', 'cloud_artwork_sync')
    .not('approved_at', 'is', null)
    .is('retired_at', null)
    .order('version', { ascending: false })
    .limit(1)
    .single()
  if (notice.error) throw notice.error
  a = await createParent('A', notice.data.version)
  b = await createParent('B', notice.data.version)
  bBefore = await adminSnapshot(b)
}, 120_000)

afterAll(async () => {
  for (const parent of [a, b]) {
    if (!parent) continue
    const files = await admin.storage.from('artwork').list(parent.id)
    if (files.data?.length) {
      await admin.storage.from('artwork').remove(files.data.map((file) => `${parent.id}/${file.name}`))
    }
    await admin.auth.admin.deleteUser(parent.id).catch(() => undefined)
    await admin.from('transactions').delete().eq('stripe_checkout_session_id', parent.transactionId)
  }
}, 60_000)

describe('two unrelated parent accounts', () => {
  it('starts with a complete, separate set of data for each parent', () => {
    expect(bBefore).toEqual({
      profiles: 1,
      consent: 1,
      activeConsent: 1,
      artworks: 1,
      deletions: 1,
      customers: 1,
      subscriptions: 1,
      transactions: 1,
      entitlements: 1,
      files: [`${b.keptArtwork}.svg`],
    })
  })

  it.each(['A', 'B'] as const)('parent %s reads all of their own rows and none of the other parent’s', async (label) => {
    const [self, other] = label === 'A' ? [a, b] : [b, a]
    for (const { table, owner } of OWNED_TABLES) {
      const all = await self.client.from(table).select('*')
      expect(all.error, table).toBeNull()
      expect(all.data!.length, `${table} own rows`).toBeGreaterThan(0)
      expect(new Set(all.data!.map((row) => row[owner])), table).toEqual(new Set([self.id]))

      const targeted = await self.client.from(table).select('*').eq(owner, other.id)
      expect(targeted.data, `${table} filtered to the other parent`).toEqual([])
    }
    for (const table of CUSTOMER_TABLES) {
      const all = await self.client.from(table).select('*')
      expect(all.error, table).toBeNull()
      expect(all.data!.map((row) => row.stripe_customer_id), table).toEqual([self.customerId])

      const targeted = await self.client.from(table).select('*').eq('stripe_customer_id', other.customerId)
      expect(targeted.data, `${table} filtered to the other parent`).toEqual([])
    }
  })

  it('does not let a parent read webhook records or anything while signed out', async () => {
    const webhooks = await a.client.from('webhook_events').select('*')
    expect(webhooks.data ?? []).toEqual([])

    const signedOut = createClient(url, anonKey, clientOptions)
    for (const table of [...OWNED_TABLES.map((entry) => entry.table), ...CUSTOMER_TABLES, 'webhook_events']) {
      const result = await signedOut.from(table).select('*')
      expect(result.data ?? [], `signed-out ${table}`).toEqual([])
    }
    const download = await signedOut.storage.from('artwork').download(filePath(b, b.keptArtwork))
    expect(download.error).not.toBeNull()
    const list = await signedOut.storage.from('artwork').list(b.id)
    expect(list.data ?? []).toEqual([])
    const consent = await signedOut.rpc('give_cloud_consent', { p_notice_version: 1 })
    expect(consent.error).not.toBeNull()
  })

  it('blocks one parent from changing or deleting the other parent’s rows', async () => {
    const forgedId = `art_${randomUUID()}`
    const insertForOther = await a.client.from('artworks').insert({
      id: forgedId,
      parent_id: b.id,
      template_id: 'sunny',
      template_version: 1,
      fills: {},
      file_path: filePath(b, forgedId),
      created_at: new Date().toISOString(),
    })
    logDenial('insert a picture row into the other account', insertForOther.error)
    expect(insertForOther.error?.code, 'insert artwork as the other parent').toBe('42501')

    const claimedId = `art_${randomUUID()}`
    const pointAtOtherFile = await a.client.from('artworks').insert({
      id: claimedId,
      parent_id: a.id,
      template_id: 'sunny',
      template_version: 1,
      fills: {},
      file_path: filePath(b, claimedId),
      created_at: new Date().toISOString(),
    })
    logDenial('point an own row at the other account’s folder', pointAtOtherFile.error)
    expect(pointAtOtherFile.error?.code, 'claim the other parent’s folder').toBe('23514')

    const deleteOther = await a.client.from('artworks').delete().eq('id', b.keptArtwork).select('id')
    expect(deleteOther.data ?? []).toEqual([])

    const updateOther = await a.client.from('artworks').update({ fills: {} }).eq('id', b.keptArtwork)
    expect(updateOther.error, 'artworks cannot be edited in place').not.toBeNull()

    const profile = await a.client.from('profiles').update({ language: 'en' }).eq('id', b.id).select('id')
    expect(profile.data ?? []).toEqual([])

    const writes = {
      'grant self a pack': a.client.from('entitlements').insert({ parent_id: a.id, scope: 'pack', pack_id: 'safari-garden', source_type: 'transaction', source_id: 'cs_test_forged' }),
      'revoke the other pack': a.client.from('entitlements').update({ revoked_at: new Date().toISOString() }).eq('parent_id', b.id),
      'delete the other pack': a.client.from('entitlements').delete().eq('parent_id', b.id),
      'forge consent for the other parent': a.client.from('consent_records').insert({
        parent_id: b.id,
        purpose: 'cloud_artwork_sync',
        notice_version: 1,
        verification_method: 'email_link_recent_sign_in',
        verification_reference: 'forged',
      }),
      'withdraw the other consent': a.client.from('consent_records').update({ withdrawn_at: new Date().toISOString() }).eq('parent_id', b.id),
      'create a billing customer': a.client.from('billing_customers').insert({ parent_id: a.id, stripe_customer_id: 'cus_forged' }),
      'take over the other customer': a.client.from('billing_customers').update({ parent_id: a.id }).eq('parent_id', b.id),
      'move the other subscription': a.client.from('subscriptions').update({ stripe_customer_id: a.customerId }).eq('stripe_subscription_id', b.subscriptionId),
      'delete the other payment': a.client.from('transactions').delete().eq('stripe_checkout_session_id', b.transactionId),
      'record a checkout directly': a.client.rpc('fulfil_checkout_session', {
        p_session_id: 'cs_test_forged',
        p_payment_intent_id: null,
        p_customer_id: null,
        p_parent_id: a.id,
        p_pack_ids: ['safari-garden'],
        p_amount_minor: 0,
        p_currency: 'usd',
        p_occurred_at: new Date().toISOString(),
      }),
      'clear the other removal marks': a.client.from('artwork_deletions').delete().eq('parent_id', b.id),
      'write a webhook record': a.client.from('webhook_events').insert({ event_id: `evt_forged_${stamp}`, event_type: 'subscription.created', occurred_at: new Date().toISOString() }),
    }
    const results = await Promise.all(Object.values(writes))
    for (const [index, name] of Object.keys(writes).entries()) {
      logDenial(name, results[index].error)
      expect(results[index].error?.code, name).toBe('42501')
    }
  })

  it('blocks one parent from the other parent’s picture files', async () => {
    const bucket = a.client.storage.from('artwork')
    const target = filePath(b, b.keptArtwork)

    const attempts = {
      download: await bucket.download(target),
      'signed link': await bucket.createSignedUrl(target, 60),
      'upload into the other folder': await bucket.upload(`${b.id}/art_${randomUUID()}.svg`, svg(), { contentType: 'image/svg+xml' }),
      'overwrite the other file': await bucket.upload(target, svg(), { contentType: 'image/svg+xml', upsert: true }),
      'move the other file': await bucket.move(target, filePath(a, `art_${randomUUID()}`)),
    }
    for (const [name, result] of Object.entries(attempts)) {
      logDenial(`storage ${name}`, result.error)
      expect(result.error, name).not.toBeNull()
    }
    expect((await bucket.list(b.id)).data ?? []).toEqual([])
    const removal = await bucket.remove([target])
    console.log(`[live] storage remove the other file: ${removal.data?.length ?? 0} removed`)
    expect(removal.data ?? []).toEqual([])

    const own = await bucket.download(filePath(a, a.keptArtwork))
    expect(own.error, 'a parent can still download their own picture').toBeNull()
  })

  it('leaves the other parent’s data exactly as it was after all those attempts', async () => {
    expect(await adminSnapshot(b)).toEqual(bBefore)
  })

  it('turning off cloud saving only affects the parent who did it', async () => {
    const off = await a.client.rpc('disable_cloud_saving')
    expect(off.error).toBeNull()

    expect((await a.client.rpc('has_cloud_consent')).data).toBe(false)
    expect((await b.client.rpc('has_cloud_consent')).data).toBe(true)
    expect((await a.client.from('artworks').select('id')).data).toEqual([])
    expect(await adminSnapshot(b)).toEqual(bBefore)

    const stillSaving = await uploadArtwork(b, 'sunny')
    await b.client.from('artworks').delete().eq('id', stillSaving)
    await b.client.storage.from('artwork').remove([filePath(b, stillSaving)])
  })

  it('deleting one account leaves the other account untouched', async () => {
    const deleted = await admin.auth.admin.deleteUser(a.id)
    expect(deleted.error).toBeNull()
    expect((await admin.auth.admin.getUserById(a.id)).data?.user ?? null).toBeNull()

    const bNow = await adminSnapshot(b)
    expect({ ...bNow, deletions: bBefore.deletions }).toEqual(bBefore)
    const session = await b.client.auth.getUser()
    expect(session.data.user?.id).toBe(b.id)
    expect((await b.client.from('entitlements').select('id')).data).toHaveLength(1)
  })
})
