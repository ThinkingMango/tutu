'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, Sparkles } from 'lucide-react'
import type { CheckoutOutcome } from '@/app/actions/checkout'
import { CheckoutDialog } from '@/components/parent/pricing/checkout-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { useParentUser } from '@/lib/auth/client'
import {
  STANDARD_UNLOCK_CENTS,
  bundleNudge,
  formatPrice,
  quotePacks,
  type PackOffer,
} from '@/lib/billing/pricing'
import { REFUNDS_HREF, REFUND_WINDOW_DAYS } from '@/lib/legal'
import type { Pack } from '@/lib/packs'
import { cn } from '@/lib/utils'

type OrderSummaryProps = {
  packs: readonly Pack[]
  withStandard: boolean
  /** How many packs the parent could still add, including those already chosen. */
  buyable: number
  onPurchased: (outcome: CheckoutOutcome) => void
}

function groupOffers(offers: readonly PackOffer[]) {
  const groups = new Map<string, { offer: PackOffer; count: number }>()
  for (const offer of offers) {
    const group = groups.get(offer.id)
    if (group) group.count++
    else groups.set(offer.id, { offer, count: 1 })
  }
  return [...groups.values()]
}

export function OrderSummary({ packs, withStandard, buyable, onPurchased }: OrderSummaryProps) {
  const user = useParentUser()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const quote = quotePacks(packs.length)
  const totalCents = quote.totalCents + (withStandard ? STANDARD_UNLOCK_CENTS : 0)
  const empty = packs.length === 0 && !withStandard
  const nudge = packs.length > 0 ? bundleNudge(packs.length, buyable) : null

  return (
    <aside
      aria-labelledby="order-title"
      className="flex flex-col gap-5 rounded-3xl border-2 border-primary bg-card p-6 md:sticky md:top-24"
    >
      <h2 id="order-title" className="text-xl font-black">
        你的订单
      </h2>

      <div aria-live="polite" className="flex flex-col gap-5">
        {empty ? (
          <p className="leading-relaxed text-muted-foreground">
            添加你想要的画册，系统会自动为你计算最低组合价。
          </p>
        ) : (
          <>
            {packs.length > 0 && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {new Intl.ListFormat('en', { type: 'conjunction' }).format(packs.map((p) => p.name))}
              </p>
            )}

            <dl className="flex flex-col gap-3 text-sm">
              {groupOffers(quote.offers).map(({ offer, count }) => (
                <div key={offer.id} className="flex items-baseline justify-between gap-3">
                  <dt className="font-semibold">{count > 1 ? `${offer.name} × ${count}` : offer.name}</dt>
                  <dd className="font-bold tabular-nums">{formatPrice(offer.priceCents * count)}</dd>
                </div>
              ))}
              {withStandard && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-semibold">Standard pack unlock</dt>
                  <dd className="font-bold tabular-nums">{formatPrice(STANDARD_UNLOCK_CENTS)}</dd>
                </div>
              )}
            </dl>

            <div className="flex flex-col gap-1 border-t pt-4">
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-extrabold">Total</span>
                <span className="text-3xl font-black tabular-nums">{formatPrice(totalCents)}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {quote.savingsCents > 0
                  ? `一次性付款。组合购买为你节省 ${formatPrice(quote.savingsCents)}。`
                  : '一次性付款，永久拥有。'}
              </p>
            </div>
          </>
        )}

        {nudge && (
          <p className="flex items-start gap-2 rounded-2xl bg-secondary p-3 text-sm leading-relaxed">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {`再添加 ${nudge.morePacks} 本画册，只需多付 ${formatPrice(nudge.extraCents)}，即可享受「${nudge.offer.name}」优惠。`}
            </span>
          </p>
        )}
      </div>

      {!user ? (
        <Link
          href="/parent/sign-in?next=/parent/billing"
          className={cn(buttonVariants(), 'h-12 w-full rounded-full text-base font-bold')}
        >
          登录后购买
        </Link>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            disabled={empty}
            onClick={() => setCheckoutOpen(true)}
            className="h-12 w-full rounded-full text-base font-bold"
          >
            {empty ? '购买' : `以 ${formatPrice(totalCents)} 购买`}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
            <Lock className="size-3.5" aria-hidden="true" />
            通过 Stripe 安全地一次性付款
          </p>
          <CheckoutDialog
            open={checkoutOpen}
            onOpenChange={setCheckoutOpen}
            order={{ packIds: packs.map((pack) => pack.id), withStandard }}
            totalLabel={formatPrice(totalCents)}
            onFinished={(outcome) => {
              setCheckoutOpen(false)
              onPurchased(outcome)
            }}
          />
        </div>
      )}

      <p className="text-center text-sm leading-relaxed text-muted-foreground">
        {`改变主意了？${REFUND_WINDOW_DAYS} 天内可全额退款。`}
        <Link
          href={REFUNDS_HREF}
          className="font-bold text-foreground underline underline-offset-4 outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          退款政策
        </Link>
      </p>
    </aside>
  )
}
