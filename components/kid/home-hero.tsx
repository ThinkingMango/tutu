import Link from 'next/link'
import type { CSSProperties } from 'react'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { EMPTY_FILLS, type Fills } from '@/lib/artwork/library'
import { latestVersion } from '@/lib/mandalas'
import { crayonStyle, type Crayon } from '@/lib/pack-theme'
import { colorHref, packPages } from '@/lib/packs'
import type { ColorKey } from '@/lib/palette'

/** Free pages never depend on who is signed in, so this row renders on the server and never shifts. */
const QUICK_PICKS = packPages('standard')
  .filter((mandala) => mandala.tier === 'free')
  .slice(0, 4)
const TILE_CRAYONS: readonly Crayon[] = ['pink', 'sky', 'lime', 'orange']

const sample = latestVersion(QUICK_PICKS[QUICK_PICKS.length - 1])
const SAMPLE_COLORS: readonly ColorKey[] = ['pink', 'sky', 'orange', 'purple', 'lime', 'red', 'blue']
const sampleFills: Fills = Object.fromEntries(
  sample.regions.map((region, i) => [region.id, region.id === 'center' ? 'orange' : SAMPLE_COLORS[i % SAMPLE_COLORS.length]]),
)

export function HomeHero() {
  return (
    <section
      aria-labelledby="home-title"
      className="flex flex-col gap-6 rounded-[2.5rem] bg-swatch-yellow p-5 text-ink md:gap-8 md:p-8"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 id="home-title" className="text-5xl font-black tracking-tight text-balance md:text-6xl">
            Let&apos;s color!
          </h1>
          <p className="text-lg font-bold text-pretty md:text-xl">Tap a flower to start.</p>
        </div>
        <MandalaArt
          version={sample}
          fills={sampleFills}
          className="animate-slow-spin size-24 shrink-0 drop-shadow-sm md:size-32"
        />
      </div>

      <ul aria-label="Free pictures" className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:gap-5">
        {QUICK_PICKS.map((mandala, i) => (
          <li key={mandala.id} className="animate-pop-in" style={{ '--i': i } as CSSProperties}>
            <Link
              href={colorHref(mandala)}
              aria-label={`Color ${mandala.name}`}
              style={crayonStyle(TILE_CRAYONS[i % TILE_CRAYONS.length])}
              className="pack-theme tactile flex aspect-square items-center justify-center rounded-[2rem] border-4 border-(--pack) bg-card p-3 outline-none [--tactile-edge:var(--pack-edge)] focus-visible:ring-4 focus-visible:ring-ink focus-visible:ring-offset-4 focus-visible:ring-offset-swatch-yellow md:p-4"
            >
              <MandalaArt version={latestVersion(mandala)} fills={EMPTY_FILLS} className="size-full" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
