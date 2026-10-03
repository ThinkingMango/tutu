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
  '选择你想要的画册。价格由我们的服务器计算，你看到的总价就是实际支付的金额。',
  '在安全的 Stripe 结账页面一次性付款。你的银行卡信息只发送给 Stripe，我们不会接触到。',
  '画册会立即在你的账号中解锁，在你登录的每台设备上都可以永久使用。',
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

  const statusOf = (id: PackId) => (owned.has(id) ? '已永久拥有' : null)
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
        <h1 className="text-3xl font-black">价格</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
          画册一次购买，永久拥有。没有订阅，组合购买更优惠。
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
            {'暂时无法查询你的购买记录。在查询成功之前，付费图画会保持锁定。'}
          </p>
        )}
      </div>

      <section aria-labelledby="offers" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="offers" className="text-2xl font-black">
            画册
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            {`每本画册 ${formatPrice(PACK_PRICE_CENTS)}，无论包含多少张图画。可以随意自由搭配。`}
          </p>
        </div>
        <OfferGrid />
      </section>

      <section aria-labelledby="choose" className="flex flex-col gap-4">
        <h2 id="choose" className="text-2xl font-black">
          选择你的画册
        </h2>

        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-8">
            <PackGroup
              title={hasGrownUpPacks ? '给孩子' : null}
              description="大而简单的图画，适合 3 到 7 岁。"
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
                title="给你自己"
                description="适合大人的精细曼陀罗，在家长验证后涂色。价格相同，也计入组合优惠。"
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
          购买流程
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
