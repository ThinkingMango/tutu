import type { Metadata } from 'next'
import { Sprout } from 'lucide-react'
import { KidPageHeader } from '@/components/kid/kid-page-header'
import { MyGarden } from '@/components/kid/my-garden'
import { GARDEN_CRAYON, crayonStyle } from '@/lib/pack-theme'

export const metadata: Metadata = { title: '我的花园' }

export default function GardenPage() {
  return (
    <main
      style={crayonStyle(GARDEN_CRAYON)}
      className="pack-theme mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-5 pt-6 pb-16 md:px-10 md:pt-8"
    >
      <KidPageHeader
        title="我的花园"
        icon={
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-(--pack)"
            aria-hidden="true"
          >
            <Sprout className="size-8" strokeWidth={2.5} />
          </span>
        }
      />
      <MyGarden />
    </main>
  )
}
