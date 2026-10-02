'use client'

import { useSearchParams } from 'next/navigation'
import { ColoringScreen } from '@/components/coloring/coloring-screen'
import type { Mandala } from '@/lib/mandalas'

/** Reads `?art=<garden picture id>` from My garden. A new id is a new visit, so the screen remounts. */
export function ColoringRoute({ mandala }: { mandala: Mandala }) {
  const gardenArtworkId = useSearchParams().get('art')
  return <ColoringScreen key={gardenArtworkId ?? 'fresh'} mandala={mandala} gardenArtworkId={gardenArtworkId} />
}

export function ColoringFallback() {
  return <main className="min-h-dvh bg-background" aria-busy="true" />
}
