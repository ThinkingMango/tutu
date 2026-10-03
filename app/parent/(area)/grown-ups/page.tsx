import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GrownUpShelf } from '@/components/parent/grown-up-shelf'
import { GROWN_UPS_OFFERED } from '@/lib/packs'

export const metadata: Metadata = { title: GROWN_UPS_OFFERED ? '大人涂色' : '找不到页面' }

export default function GrownUpsPage() {
  if (!GROWN_UPS_OFFERED) notFound()

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8 md:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-balance">Grown-up coloring</h1>
        <p className="leading-relaxed text-muted-foreground text-pretty">
          {'为你准备的更精细的图画和 24 色调色板。它们只在家长验证后可见，不会出现在孩子的书架上。'}
        </p>
      </div>
      <GrownUpShelf />
    </main>
  )
}
