'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Paintbrush, Sprout, X } from 'lucide-react'
import { CrossCheckDialog, RemovePreview } from '@/components/coloring/kid-dialogs'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { pictureCount, useGarden } from '@/hooks/use-garden'
import type { Artwork } from '@/lib/artwork/library'
import { useHydrated } from '@/lib/local-store'
import { getMandala } from '@/lib/mandalas'
import { colorHref } from '@/lib/packs'
import { cn } from '@/lib/utils'

function EmptyGarden() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-[2.5rem] border-4 border-dashed border-(--pack) p-8 text-center md:p-12">
      <div className="flex items-end gap-3" aria-hidden="true">
        {['size-16', 'size-24', 'size-16'].map((size, i) => (
          <span
            key={i}
            className={cn('flex items-center justify-center rounded-full bg-(--pack-tint) text-(--pack-edge)', size)}
          >
            <Sprout className="size-1/2" strokeWidth={2.5} />
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-3xl font-black text-balance md:text-4xl">这里还空空的</p>
        <p className="text-lg font-bold leading-relaxed text-muted-foreground text-pretty">
          {'涂完一幅画，点一下“我涂好了”，它就会长在这里。'}
        </p>
      </div>
      <Link
        href="/"
        className="tactile flex h-18 items-center gap-3 rounded-full bg-primary px-8 text-xl font-black text-primary-foreground outline-none [--tactile-edge:color-mix(in_oklch,var(--primary)_60%,var(--ink))] focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4"
      >
        <Paintbrush className="size-7" strokeWidth={2.75} aria-hidden="true" />
        开始涂色
      </Link>
    </div>
  )
}

export function MyGarden() {
  const hydrated = useHydrated()
  const { library, artworks } = useGarden()
  const [target, setTarget] = useState<Artwork | null>(null)
  const [open, setOpen] = useState(false)

  if (!hydrated) return null
  if (artworks.length === 0) return <EmptyGarden />

  const targetVersion = target && library.templates.version(target.templateId, target.templateVersion)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-lg font-bold text-muted-foreground">{pictureCount(artworks.length)}</p>
      <ul aria-label="我的图画" className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:gap-7 lg:grid-cols-4">
        {artworks.map((artwork) => {
          const version = library.templates.version(artwork.templateId, artwork.templateVersion)
          if (!version) return null
          const mandala = getMandala(artwork.templateId)
          const name = mandala?.name ?? '小花'
          const art = <MandalaArt version={version} fills={artwork.fills} className="size-full" />
          return (
            <li key={artwork.id} className="relative">
              {mandala ? (
                <Link
                  href={`${colorHref(mandala)}?art=${encodeURIComponent(artwork.id)}`}
                  aria-label={`再给「${name}」涂一次`}
                  className="tactile flex aspect-square items-center justify-center rounded-[2rem] border-4 border-(--pack) bg-card p-3 outline-none [--tactile-edge:var(--pack-edge)] focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {art}
                </Link>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-[2rem] border-4 border-(--pack) bg-card p-3">
                  {art}
                </div>
              )}
              <button
                type="button"
                aria-label={`把「${name}」从我的花园拿走`}
                title="拿走"
                onClick={() => {
                  setTarget(artwork)
                  setOpen(true)
                }}
                className="tactile absolute -top-3 -right-3 flex size-12 items-center justify-center rounded-full border-2 border-border bg-background text-foreground outline-none [--tactile-edge:var(--border)] focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <X className="size-6" strokeWidth={3} aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>

      {target && targetVersion && (
        <CrossCheckDialog
          open={open}
          onOpenChange={setOpen}
          title="要拿走吗？"
          description="这朵花会离开你的花园。"
          preview={<RemovePreview version={targetVersion} fills={target.fills} />}
          cancelLabel="不，留着它"
          confirmLabel="好，拿走吧"
          onConfirm={() => library.removeFromGallery(target.id)}
        />
      )}
    </div>
  )
}
