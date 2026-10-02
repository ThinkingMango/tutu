'use client'

import { Suspense, useState } from 'react'
import type { CheckoutOutcome } from '@/app/actions/checkout'
import { PackCard } from '@/components/parent/pack-card'
import { OfferGrid } from '@/components/parent/pricing/offer-grid'
import { OrderSummary } from '@/components/parent/pricing/order-summary'
import { PurchaseNotice, ReturnedFromCheckout } from '@/components/parent/pricing/purchase-notice'
import { StandardUnlockCard } from '@/components/parent/pricing/standard-unlock-card'
import { PACK_PRICE_CENTS, formatPrice } from '@/lib/billing/pricing'
import { refreshEntitlements, useEntitlements } from '@/lib/entitlements'
import { PackGroup } from '@/components/parent/pricing/pack-group'
import {
  FOR_YOU_ANCHOR,
  SOLD_GROWN_UP_PACKS,
  SOLD_KIDS_PACKS,
  SOLD_PACKS,
  packPages,
  type Pack,
  type PackId,
} from '@/lib/packs'

const HOW_BUYING_WORKS = [
  'Choose your packs. Our server works out the price, so the total you see is the total you pay.',
  'Pay once in a secure Stripe checkout. Your card details go to Stripe and never reach us.',
  'Your packs open on your account straight away and stay yours on every device you sign in on.',
]

const STANDARD_PAID = packPages('standard').filter((page) => page.tier !== 'free')

export function BillingView() {
  const { packs: owned, isUnlocked, failed } = useEntitlements()
  const [chosen, setChosen] = useState<ReadonlySet<PackId>>(() => new Set())
  const [standardChosen, setStandardChosen] = useState(false)
  const [outcome, setOutcome] = useState<CheckoutOutcome | null>(null)

  const handlePurchased = (result: CheckoutOutcome) => {
    setOutcome(result)
    if (result === 'failed') return
    setChosen(new Set())
    setStandardChosen(false)
    void refreshEntitlements()
  }

  const statusOf = (id: PackId) => (owned.has(id) ? 'Yours to keep' : null)
  const buyable = SOLD_PACKS.filter((pack) => !statusOf(pack.id))
  const inOrder = buyable.filter((pack) => chosen.has(pack.id))
  const standardUnlocked = STANDARD_PAID.every(isUnlocked)

  const toggle = (id: PackId) =>
    setChosen((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const hasGrownUpPacks = SOLD_GROWN_UP_PACKS.length > 0
  const renderPack = (pack: Pack) => (
    <PackCard
      key={pack.id}
      pack={pack}
      status={statusOf(pack.id)}
      selected={chosen.has(pack.id) && !statusOf(pack.id)}
      onToggle={() => toggle(pack.id)}
      headingLevel={hasGrownUpPacks ? 'h4' : 'h3'}
    />
  )

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-black">Pricing</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
          Buy picture packs once and keep them for good. There’s no subscription, and bundles bring the price down.
        </p>

        {outcome ? (
          <PurchaseNotice outcome={outcome} />
        ) : (
          <Suspense fallback={null}>
            <ReturnedFromCheckout />
          </Suspense>
        )}

        {failed && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {'We couldn’t check your purchases right now. Paid pictures stay locked until we can.'}
          </p>
        )}
      </div>

      <section aria-labelledby="offers" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="offers" className="text-2xl font-black">
            Picture packs
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            {`Every pack is ${formatPrice(PACK_PRICE_CENTS)}, however many pictures it has. Mix and match any packs you like.`}
          </p>
        </div>
        <OfferGrid />
      </section>

      <section aria-labelledby="choose" className="flex flex-col gap-4">
        <h2 id="choose" className="text-2xl font-black">
          Choose your packs
        </h2>

        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-8">
            <PackGroup
              title={hasGrownUpPacks ? 'For your child' : null}
              description="Big, simple pictures for ages 3 to 7."
            >
              {SOLD_KIDS_PACKS.map(renderPack)}
              <StandardUnlockCard
                unlocked={standardUnlocked}
                selected={standardChosen && !standardUnlocked}
                onToggle={() => setStandardChosen((value) => !value)}
              />
            </PackGroup>

            {hasGrownUpPacks && (
              <PackGroup
                id={FOR_YOU_ANCHOR}
                title="For you"
                description="Detailed mandalas for grown-ups, colored behind the parent gate. Same price, and they count toward bundles."
              >
                {SOLD_GROWN_UP_PACKS.map(renderPack)}
              </PackGroup>
            )}
          </div>

          <OrderSummary
            packs={inOrder}
            withStandard={standardChosen && !standardUnlocked}
            buyable={buyable.length}
            onPurchased={handlePurchased}
          />
        </div>
      </section>

      <section aria-labelledby="how-buying-works" className="flex flex-col gap-4 rounded-3xl border bg-card p-6">
        <h2 id="how-buying-works" className="font-extrabold">
          How buying works
        </h2>
        <ol className="flex flex-col gap-3">
          {HOW_BUYING_WORKS.map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-black text-foreground"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
