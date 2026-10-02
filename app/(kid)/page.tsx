import { BrandMark } from '@/components/brand-mark'
import { GardenCover } from '@/components/kid/garden-cover'
import { HomeHero } from '@/components/kid/home-hero'
import { PackShelf } from '@/components/kid/pack-shelf'
import { ParentEntryButton } from '@/components/kid/parent-entry-button'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-5 pt-6 pb-16 md:gap-12 md:px-10 md:pt-8">
      <header className="flex items-center justify-between gap-4">
        <BrandMark />
        <ParentEntryButton />
      </header>
      <div className="grid gap-6 md:gap-8 lg:grid-cols-[2fr_1fr]">
        <HomeHero />
        <GardenCover />
      </div>
      <PackShelf />
    </main>
  )
}
