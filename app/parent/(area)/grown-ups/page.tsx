import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GrownUpShelf } from '@/components/parent/grown-up-shelf'
import { GROWN_UPS_OFFERED } from '@/lib/packs'

export const metadata: Metadata = { title: GROWN_UPS_OFFERED ? 'Grown-up coloring' : 'Page not found' }

export default function GrownUpsPage() {
  if (!GROWN_UPS_OFFERED) notFound()

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8 md:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-balance">Grown-up coloring</h1>
        <p className="leading-relaxed text-muted-foreground text-pretty">
          {"Finer pages and a 24-color palette, made for you. They stay behind the parent gate and never appear on the kids' shelf."}
        </p>
      </div>
      <GrownUpShelf />
    </main>
  )
}
