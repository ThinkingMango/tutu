'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Lock, UsersRound } from 'lucide-react'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { useDraftView } from '@/hooks/use-artwork-library'
import { EMPTY_FILLS } from '@/lib/artwork/library'
import { latestVersion, type Mandala } from '@/lib/mandalas'
import { colorHref } from '@/lib/packs'
import { cn } from '@/lib/utils'

/** Wears the page's crayon when a `pack-theme` parent sets one, and plain gray otherwise. */
const tileClass =
  'tactile group relative flex aspect-square items-center justify-center rounded-[2rem] border-4 border-[var(--pack,var(--border))] bg-card p-5 outline-none [--tactile-edge:var(--pack-edge,var(--border))] focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4 md:p-6'

export function MandalaTile({ mandala, locked }: { mandala: Mandala; locked: boolean }) {
  const { version, fills } = useDraftView(mandala)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!asking) return
    const timer = setTimeout(() => setAsking(false), 2600)
    return () => clearTimeout(timer)
  }, [asking])

  if (!locked) {
    return (
      <Link href={colorHref(mandala)} aria-label={`Color ${mandala.name}`} className={tileClass}>
        <MandalaArt version={version} fills={fills} className="size-full" />
      </Link>
    )
  }

  return (
    <button
      type="button"
      aria-label={`${mandala.name}, locked. Ask a grown-up.`}
      onClick={() => setAsking(true)}
      className={cn(tileClass, 'bg-[var(--pack-tint,var(--secondary))]')}
    >
      <MandalaArt version={latestVersion(mandala)} fills={EMPTY_FILLS} className="size-full opacity-40" />
      <span className="absolute top-3 right-3 flex size-12 items-center justify-center rounded-full bg-ink text-background">
        <Lock className="size-6" strokeWidth={2.75} aria-hidden="true" />
      </span>
      {asking && (
        <span
          role="status"
          className="animate-bubble-in absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-2xl bg-ink px-3 py-3 text-lg font-extrabold text-background"
        >
          <UsersRound className="size-6 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          Ask a grown-up
        </span>
      )}
    </button>
  )
}
