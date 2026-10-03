import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ColoringScreen } from '@/components/coloring/coloring-screen'
import { GrownUpLocked } from '@/components/parent/grown-up-locked'
import { MANDALAS, getMandala } from '@/lib/mandalas'
import { GROWN_UPS_OFFERED, isGrownUpPage } from '@/lib/packs'

type Params = { params: Promise<{ id: string }> }

export function generateStaticParams() {
  return GROWN_UPS_OFFERED ? MANDALAS.filter(isGrownUpPage).map((m) => ({ id: m.id })) : []
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const mandala = getMandala(id)
  return { title: mandala ? `给「${mandala.name}」涂色` : '找不到这幅画' }
}

/** Grown-up pages are colored here, behind the parent gate, never from the kids' area. */
export default async function GrownUpColorPage({ params }: Params) {
  const { id } = await params
  const mandala = getMandala(id)
  if (!GROWN_UPS_OFFERED || !mandala || !isGrownUpPage(mandala)) notFound()

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <ColoringScreen mandala={mandala} lockedView={<GrownUpLocked mandala={mandala} />} />
    </div>
  )
}
