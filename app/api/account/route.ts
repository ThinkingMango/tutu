import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DeletionErrorCode } from '@/lib/account/client'
import { CONSENT_WINDOW_MS, latestSignInAt } from '@/lib/cloud-consent/notice'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ARTWORK_BUCKET = 'artwork'
const REMOVE_BATCH = 100
const MAX_REMOVE_ROUNDS = 50
const LIVE_PLAN_STATUSES = ['active', 'trialing', 'past_due', 'paused']

function fail(error: DeletionErrorCode, status: number) {
  return NextResponse.json({ error }, { status })
}

async function removeAllFiles(admin: SupabaseClient, parentId: string) {
  const bucket = admin.storage.from(ARTWORK_BUCKET)
  for (let round = 0; round < MAX_REMOVE_ROUNDS; round++) {
    const { data, error } = await bucket.list(parentId, { limit: REMOVE_BATCH })
    if (error) throw new Error(`listing files failed: ${error.message}`)
    if (!data?.length) return
    const { error: removeError } = await bucket.remove(data.map((file) => `${parentId}/${file.name}`))
    if (removeError) throw new Error(`removing files failed: ${removeError.message}`)
  }
  throw new Error('too many files to remove in one request')
}

async function hasLivePlan(admin: SupabaseClient, parentId: string) {
  const { data: customers, error } = await admin
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('parent_id', parentId)
  if (error) throw new Error(`checking billing failed: ${error.message}`)
  if (!customers.length) return false
  const { count, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id', { count: 'exact', head: true })
    .in(
      'stripe_customer_id',
      customers.map((customer) => customer.stripe_customer_id),
    )
    .in('status', LIVE_PLAN_STATUSES)
  if (subscriptionError) throw new Error(`checking subscriptions failed: ${subscriptionError.message}`)
  return (count ?? 0) > 0
}

/**
 * Deletes the signed-in parent's account right away. Needs a fresh email-link sign-in and the
 * account email typed back. Cloud picture files are removed first; deleting the user then removes
 * every row that belongs to them (profile, consent, artworks, entitlements, subscriptions). Payment
 * transactions are kept for accounting but unlinked from the account by the database.
 */
export async function DELETE(request: NextRequest) {
  const fetchSite = request.headers.get('sec-fetch-site')
  if ((fetchSite && fetchSite !== 'same-origin') || !request.headers.get('content-type')?.includes('application/json')) {
    return fail('forbidden', 403)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub || claims.is_anonymous || typeof claims.email !== 'string') {
    return fail('not_signed_in', 401)
  }

  const signedInAt = latestSignInAt(claims.amr)
  if (!signedInAt || Date.now() - signedInAt.getTime() > CONSENT_WINDOW_MS) {
    return fail('recent_sign_in_required', 403)
  }

  const body = (await request.json().catch(() => null)) as { confirmEmail?: unknown } | null
  const typed = typeof body?.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : ''
  if (typed !== claims.email.toLowerCase()) {
    return fail('confirmation_mismatch', 400)
  }

  const parentId = claims.sub
  const admin = createAdminClient()
  try {
    if (await hasLivePlan(admin, parentId)) return fail('active_plan', 409)
    await removeAllFiles(admin, parentId)
    const { error: deleteError } = await admin.auth.admin.deleteUser(parentId)
    if (deleteError) throw new Error(`deleting user failed: ${deleteError.message}`)
  } catch (err) {
    console.error('Account deletion failed', err instanceof Error ? err.message : err)
    return fail('unknown', 500)
  }

  // Another device may have finished an upload between the first sweep and the user being deleted.
  await removeAllFiles(admin, parentId).catch((err) => {
    console.error('Final file sweep after account deletion failed', parentId, err instanceof Error ? err.message : err)
  })

  return NextResponse.json({ deleted: true })
}
