'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
// The `pure` entry only adds Stripe.js when loadStripe() runs, i.e. once a checkout opens. The main
// entry adds it as soon as the Pricing page loads.
import { loadStripe } from '@stripe/stripe-js/pure'
import type { Stripe } from '@stripe/stripe-js'
import { Loader2 } from 'lucide-react'
import {
  confirmPackCheckout,
  startPackCheckout,
  type CheckoutError,
  type CheckoutOutcome,
} from '@/app/actions/checkout'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { markGrownUpDocument } from '@/lib/grown-up-scripts'

const stripeByKey = new Map<string, Promise<Stripe | null>>()

/** The server picks the key, so production gets the live key and previews the test key. */
function stripeFor(publishableKey: string) {
  let promise = stripeByKey.get(publishableKey)
  if (!promise) {
    markGrownUpDocument()
    promise = loadStripe(publishableKey)
    stripeByKey.set(publishableKey, promise)
  }
  return promise
}

const ERROR_MESSAGES: Record<CheckoutError, string> = {
  empty: 'Choose at least one pack first.',
  unknown_pack: 'One of those packs isn’t for sale any more. Please refresh the page and choose again.',
  already_owned: 'You already have one of those packs. Please refresh the page to see your packs.',
  too_many: 'That order has too many packs in it.',
  not_signed_in: 'Please sign in again to buy packs.',
  invalid: 'Something went wrong with that order. Please refresh the page and try again.',
  unavailable: 'Checkout isn’t available right now. Please try again in a moment.',
}

type Order = { packIds: string[]; withStandard: boolean }

type CheckoutDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order
  totalLabel: string
  onFinished: (outcome: CheckoutOutcome) => void
}

function CheckoutForm({ order, onFinished }: Pick<CheckoutDialogProps, 'order' | 'onFinished'>) {
  const [attemptId] = useState(() => crypto.randomUUID())
  const { data, error } = useSWR(
    ['pack-checkout', attemptId] as const,
    () => startPackCheckout({ ...order, attemptId }),
    { revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false },
  )

  if (error || (data && !data.ok)) {
    return (
      <p role="alert" className="rounded-2xl bg-secondary p-4 text-sm leading-relaxed font-semibold">
        {data && !data.ok ? ERROR_MESSAGES[data.error] : ERROR_MESSAGES.unavailable}
      </p>
    )
  }

  if (!data) {
    return (
      <p className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Opening secure checkout
      </p>
    )
  }

  const { clientSecret, sessionId, publishableKey } = data
  return (
    <EmbeddedCheckoutProvider
      stripe={stripeFor(publishableKey)}
      options={{ clientSecret, onComplete: () => void confirmPackCheckout(sessionId).then(onFinished) }}
    >
      <EmbeddedCheckout className="overflow-hidden rounded-2xl" />
    </EmbeddedCheckoutProvider>
  )
}

export function CheckoutDialog({ open, onOpenChange, order, totalLabel, onFinished }: CheckoutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Checkout</DialogTitle>
          <DialogDescription>{`${totalLabel}, paid once. Card details go straight to Stripe.`}</DialogDescription>
        </DialogHeader>
        {open && <CheckoutForm order={order} onFinished={onFinished} />}
      </DialogContent>
    </Dialog>
  )
}
