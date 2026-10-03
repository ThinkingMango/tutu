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
    title: '谢谢！你的画册已准备好。',
    body: '在你登录的每台设备上都可以永久使用。收据正在发送到你的邮箱。',
  },
  pending: {
    icon: Clock,
    title: '付款正在处理中。',
    body: '部分付款方式需要一些时间。付款完成后画册会立即解锁。',
  },
  failed: {
    icon: Info,
    title: '暂时无法确认这笔付款。',
    body: '如果已经扣款，画册很快就会解锁。你可以刷新页面查看。',
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
