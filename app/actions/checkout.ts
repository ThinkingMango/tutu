'use server'

import { headers } from 'next/headers'
import { MAX_ORDER_PACKS, buildOrder, type OrderError } from '@/lib/billing/order'
import { fulfilCheckoutSession } from '@/lib/billing/fulfil'
import { countsInThisMode } from '@/lib/billing/mode'
import { STRIPE_LIVE, stripe, stripePublishableKey } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

const INTEGRATION_ID = 'little-mandala-packs-rqvhmtwk'
const ATTEMPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/

export type CheckoutError = OrderError | 'not_signed_in' | 'invalid' | 'unavailable'

export type CheckoutStart =
  | { ok: true; clientSecret: string; sessionId: string; publishableKey: string }
  | { ok: false; error: CheckoutError }

export type CheckoutOutcome = 'granted' | 'pending' | 'failed'

type CheckoutInput = { packIds: string[]; withStandard: boolean; attemptId: string }

async function currentParent() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub || claims.is_anonymous || typeof claims.email !== 'string') return null
  return { supabase, id: claims.sub, email: claims.email }
}

function isCheckoutInput(input: unknown): input is CheckoutInput {
  if (!input || typeof input !== 'object') return false
  const { packIds, withStandard, attemptId } = input as Record<string, unknown>
  return (
    Array.isArray(packIds) &&
    packIds.length <= MAX_ORDER_PACKS &&
    packIds.every((id) => typeof id === 'string') &&
    typeof withStandard === 'boolean' &&
    typeof attemptId === 'string' &&
    ATTEMPT_ID.test(attemptId)
  )
}

/** Opens an embedded Stripe checkout for the chosen packs, priced here rather than in the browser. */
export async function startPackCheckout(input: CheckoutInput): Promise<CheckoutStart> {
  if (!isCheckoutInput(input)) return { ok: false, error: 'invalid' }
  const parent = await currentParent()
  if (!parent) return { ok: false, error: 'not_signed_in' }

  const [rights, customer] = await Promise.all([
    parent.supabase
      .from('entitlements')
      .select('pack_id, source_id, starts_at, ends_at')
      .eq('parent_id', parent.id)
      .eq('scope', 'pack')
      .is('revoked_at', null),
    parent.supabase
      .from('billing_customers')
      .select('stripe_customer_id')
      .eq('parent_id', parent.id)
      .eq('livemode', STRIPE_LIVE)
      .maybeSingle(),
  ])
  if (rights.error || customer.error) {
    console.error('Loading purchases before checkout failed', rights.error?.code ?? customer.error?.code)
    return { ok: false, error: 'unavailable' }
  }

  const now = Date.now()
  const owned = new Set(
    rights.data.flatMap((row) =>
      row.pack_id &&
      countsInThisMode(row.source_id, STRIPE_LIVE) &&
      Date.parse(row.starts_at) <= now &&
      (!row.ends_at || Date.parse(row.ends_at) > now)
        ? [row.pack_id as string]
        : [],
    ),
  )
  const result = buildOrder(input, owned)
  if ('error' in result) return { ok: false, error: result.error }
  const { order } = result

  const origin = (await headers()).get('origin')
  if (!origin) return { ok: false, error: 'unavailable' }

  try {
    const publishableKey = stripePublishableKey()
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'payment',
        ui_mode: 'embedded_page',
        redirect_on_completion: 'if_required',
        return_url: `${origin}/parent/billing?session_id={CHECKOUT_SESSION_ID}`,
        line_items: order.lines.map((line) => ({
          quantity: line.quantity,
          price_data: { currency: 'usd', unit_amount: line.unitCents, product_data: { name: line.name } },
        })),
        client_reference_id: parent.id,
        metadata: { parent_id: parent.id, pack_ids: order.grants.join(',') },
        payment_intent_data: {
          description: `Little Mandala: ${order.summary}`.slice(0, 1000),
          metadata: { parent_id: parent.id },
        },
        ...(customer.data
          ? { customer: customer.data.stripe_customer_id }
          : { customer_creation: 'always' as const, customer_email: parent.email }),
        integration_identifier: INTEGRATION_ID,
      },
      { idempotencyKey: `pack-checkout:${parent.id}:${input.attemptId}` },
    )
    if (!session.client_secret) throw new Error('checkout session has no client secret')
    return { ok: true, clientSecret: session.client_secret, sessionId: session.id, publishableKey }
  } catch (err) {
    console.error('Starting checkout failed', err instanceof Error ? err.message : err)
    return { ok: false, error: 'unavailable' }
  }
}

/**
 * Checks a finished checkout with Stripe and opens its packs straight away, so the parent doesn't
 * wait on the webhook. Only the parent who started the checkout can confirm it.
 */
export async function confirmPackCheckout(sessionId: string): Promise<CheckoutOutcome> {
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return 'failed'
  const parent = await currentParent()
  if (!parent) return 'failed'

  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId)
    if (session.client_reference_id !== parent.id) return 'failed'
    const result = await fulfilCheckoutSession(session)
    return result === 'ignored' ? 'failed' : result
  } catch (err) {
    console.error('Confirming checkout failed', err instanceof Error ? err.message : err)
    return 'failed'
  }
}
