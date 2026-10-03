'use client'

import Link from 'next/link'
import { Sprout } from 'lucide-react'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { pictureCount, useGarden } from '@/hooks/use-garden'
import { useHydrated } from '@/lib/local-store'
import { GARDEN_CRAYON, crayonStyle } from '@/lib/pack-theme'

const COVER_SLOTS = 3
const GARDEN_STYLE = crayonStyle(GARDEN_CRAYON)

/** Always on the home screen, so children learn where finished pictures go before they finish one. */
export function GardenCover() {
  const hydrated = useHydrated()
  const { library, artworks } = useGarden()

  const shown = hydrated ? artworks : []
  const newest = shown.slice(0, COVER_SLOTS)
  const emptySlots = COVER_SLOTS - newest.length
  const summary = shown.length > 0 ? pictureCount(shown.length) : '涂好的图画会长在这里'

  return (
    <Link
      href="/garden"
      aria-label={shown.length > 0 ? `我的花园，${summary}` : '我的花园'}
      style={GARDEN_STYLE}
      className="pack-theme tactile flex flex-col gap-5 rounded-[2.5rem] border-4 border-(--pack) bg-(--pack-tint) p-5 text-ink outline-none [--tactile-edge:var(--pack-edge)] focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4 sm:flex-row sm:items-center sm:justify-between md:p-6 lg:flex-col lg:items-stretch lg:justify-center lg:gap-8"
    >
      <div className="flex items-center gap-4">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-(--pack)"
          aria-hidden="true"
        >
          <Sprout className="size-8" strokeWidth={2.5} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-2xl font-black text-balance md:text-3xl">我的花园</h2>
          <p className="min-h-7 text-base font-bold text-ink/75 text-pretty md:text-lg">{hydrated ? summary : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:w-80 sm:shrink-0 lg:w-auto" aria-hidden="true">
        {newest.map((artwork) => {
          const version = library.templates.version(artwork.templateId, artwork.templateVersion)
          return (
            <div key={artwork.id} className="aspect-square rounded-[1.5rem] bg-card p-2">
              {version && <MandalaArt version={version} fills={artwork.fills} className="size-full" />}
            </div>
          )
        })}
        {Array.from({ length: emptySlots }, (_, i) => (
          <div
            key={`empty-${i}`}
            className="flex aspect-square items-center justify-center rounded-[1.5rem] border-4 border-dashed border-(--pack) bg-card/60"
          >
            {hydrated && <Sprout className="size-8 text-(--pack-edge) opacity-60" strokeWidth={2.5} />}
          </div>
        ))}
      </div>
    </Link>
  )
}
