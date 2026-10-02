'use client'

import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { CircleCheck, Clock, Info } from 'lucide-react'
import { confirmPackCheckout, type CheckoutOutcome } from '@/app/actions/checkout'
import { refreshEntitlements } from '@/lib/entitlements'
import { cn } from '@/lib/utils'

const NOTICES: Record<CheckoutOutcome, { icon: typeof Info; title: string; body: string }> = {
  granted: {
    icon: CircleCheck,
    title: 'Thank you! Your packs are ready.',
    body: 'They’re yours to keep, on every device you sign in on. A receipt is on its way to your email.',
  },
  pending: {
    icon: Clock,
    title: 'Your payment is on its way.',
    body: 'Some payment methods take a little while. Your packs open as soon as it clears.',
  },
  failed: {
    icon: Info,
    title: 'We couldn’t confirm that payment yet.',
    body: 'If you were charged, your packs will open shortly. You can refresh this page to check.',
  },
}

export function PurchaseNotice({ outcome }: { outcome: CheckoutOutcome }) {
  const { icon: Icon, title, body } = NOTICES[outcome]
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-2xl p-4',
        outcome === 'granted' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-extrabold">{title}</p>
        <p className="text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

async function confirmReturn([, sessionId]: readonly [string, string]) {
  const outcome = await confirmPackCheckout(sessionId)
  if (outcome === 'granted') await refreshEntitlements()
  return outcome
}

/** Shown when a payment method sent the parent away from the page and Stripe brought them back. */
export function ReturnedFromCheckout() {
  const sessionId = useSearchParams().get('session_id')
  const { data } = useSWR(sessionId ? (['checkout-return', sessionId] as const) : null, confirmReturn, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  })
  return data ? <PurchaseNotice outcome={data} /> : null
}
