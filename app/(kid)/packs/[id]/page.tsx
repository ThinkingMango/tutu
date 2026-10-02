import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DraftBadge } from '@/components/kid/draft-badge'
import { KidPageHeader } from '@/components/kid/kid-page-header'
import { PackIcon } from '@/components/kid/pack-icon'
import { PackPictures } from '@/components/kid/pack-pictures'
import { packThemeStyle } from '@/lib/pack-theme'
import { KIDS_PACKS, findKidsPack } from '@/lib/packs'

type Params = { params: Promise<{ id: string }> }

export function generateStaticParams() {
  return KIDS_PACKS.map((pack) => ({ id: pack.id }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const pack = findKidsPack(id)
  return { title: pack ? pack.name : 'Pack not found' }
}

export default async function PackPage({ params }: Params) {
  const { id } = await params
  const pack = findKidsPack(id)
  if (!pack) notFound()

  return (
    <main
      style={packThemeStyle(pack.id)}
      className="pack-theme mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-5 pt-6 pb-16 md:px-10 md:pt-8"
    >
      <KidPageHeader title={pack.name} icon={<PackIcon id={pack.id} />} extra={<DraftBadge pack={pack} />} />
      <PackPictures packId={pack.id} />
    </main>
  )
}
