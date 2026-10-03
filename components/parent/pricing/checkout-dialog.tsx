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
  empty: '请先选择至少一本画册。',
  unknown_pack: '其中一本画册已停止销售。请刷新页面后重新选择。',
  already_owned: '你已经拥有其中一本画册。请刷新页面查看你的画册。',
  too_many: '这个订单中的画册太多了。',
  not_signed_in: '请重新登录后再购买画册。',
  invalid: '订单出了点问题。请刷新页面后再试。',
  unavailable: '暂时无法结账，请稍后再试。',
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
        正在打开安全结账页面
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
          <DialogTitle className="text-xl font-black">结账</DialogTitle>
          <DialogDescription>{`${totalLabel}，一次性付款。银行卡信息会直接发送给 Stripe。`}</DialogDescription>
        </DialogHeader>
        {open && <CheckoutForm order={order} onFinished={onFinished} />}
      </DialogContent>
    </Dialog>
  )
}
