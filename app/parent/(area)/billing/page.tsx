import type { Metadata } from 'next'
import { BillingView } from '@/components/parent/billing-view'

export const metadata: Metadata = {
  title: '价格',
  description: '漫涂涂图画包：单个图画包 $4.99，任选三个 $12.99，任选五个 $19.99。',
}

export default function BillingPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col px-5 py-8 md:px-8 md:py-10">
      <BillingView />
    </main>
  )
}
