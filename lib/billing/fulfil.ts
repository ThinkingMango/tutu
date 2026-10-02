import 'server-only'
import type Stripe from 'stripe'
import { parseGrants } from '@/lib/billing/order'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type FulfilResult = 'granted' | 'pending' | 'ignored'

function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : (value?.id ?? null)
}

/**
 * Records a paid checkout and opens its packs. Called by the webhook and when the parent returns
 * from checkout; the database makes a second call for the same session change nothing.
 */
export async function fulfilCheckoutSession(session: Stripe.Checkout.Session): Promise<FulfilResult> {
  if (session.mode !== 'payment') return 'ignored'
  if (session.status !== 'complete' || session.payment_status === 'unpaid') return 'pending'

  const parentId = session.metadata?.parent_id
  const grants = parseGrants(session.metadata?.pack_ids)
  if (!parentId || !UUID.test(parentId) || parentId !== session.client_reference_id || !grants?.length) {
    console.error('Paid checkout is missing its order details', session.id)
    return 'ignored'
  }

  const { error } = await createAdminClient().rpc('fulfil_checkout_session', {
    p_session_id: session.id,
    p_payment_intent_id: idOf(session.payment_intent),
    p_customer_id: idOf(session.customer),
    p_parent_id: parentId,
    p_pack_ids: grants,
    p_amount_minor: session.amount_total ?? 0,
    p_currency: session.currency ?? 'usd',
    p_occurred_at: new Date(session.created * 1000).toISOString(),
  })
  if (error) throw new Error(`recording purchase failed: ${error.message}`)
  return 'granted'
}

/** A fully refunded payment closes the packs it opened. */
export async function revokeRefundedPayment(paymentIntentId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('transactions')
    .select('stripe_checkout_session_id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle()
  if (error) throw new Error(`finding refunded payment failed: ${error.message}`)
  if (!data) return

  const sessionId = data.stripe_checkout_session_id
  const { error: transactionError } = await admin
    .from('transactions')
    .update({ status: 'refunded' })
    .eq('stripe_checkout_session_id', sessionId)
  if (transactionError) throw new Error(`marking refund failed: ${transactionError.message}`)

  const { error: entitlementError } = await admin
    .from('entitlements')
    .update({ revoked_at: new Date().toISOString() })
    .eq('source_type', 'transaction')
    .eq('source_id', sessionId)
    .is('revoked_at', null)
  if (entitlementError) throw new Error(`closing refunded packs failed: ${entitlementError.message}`)
}
