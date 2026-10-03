'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { ParentCard } from '@/components/parent/parent-card'
import { buttonVariants } from '@/components/ui/button'
import { useDraftView } from '@/hooks/use-artwork-library'
import { EMPTY_FILLS } from '@/lib/artwork/library'
import { PACK_PRICE_CENTS, formatPrice } from '@/lib/billing/pricing'
import { useEntitlements } from '@/lib/entitlements'
import { latestVersion, type Mandala } from '@/lib/mandalas'
import { FOR_YOU_ANCHOR, GROWN_UP_PACKS, colorHref, packPages, type Pack } from '@/lib/packs'
import { cn } from '@/lib/utils'

const artBox = 'flex aspect-square items-center justify-center rounded-2xl border bg-card p-3 transition-colors'

function PageTile({ mandala, locked }: { mandala: Mandala; locked: boolean }) {
  const { version, fills } = useDraftView(mandala)

  if (locked) {
    return (
      <div className="flex flex-col gap-2">
        <div className={cn(artBox, 'relative bg-secondary')}>
          <MandalaArt version={latestVersion(mandala)} fills={EMPTY_FILLS} className="size-full opacity-35" />
          <span className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-foreground text-background">
            <Lock className="size-4" strokeWidth={2.5} aria-hidden="true" />
            <span className="sr-only">已锁定</span>
          </span>
        </div>
        <span className="truncate text-sm font-bold text-muted-foreground">{mandala.name}</span>
      </div>
    )
  }

  return (
    <Link
      href={colorHref(mandala)}
      aria-label={`给${mandala.name}涂色`}
      className="group flex flex-col gap-2 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className={cn(artBox, 'group-hover:border-primary')}>
        <MandalaArt version={version} fills={fills} className="size-full" />
      </div>
      <span className="truncate text-sm font-bold">{mandala.name}</span>
    </Link>
  )
}

function PackSection({ pack }: { pack: Pack }) {
  const { isUnlocked, ready } = useEntitlements()
  const pages = packPages(pack.id)

  if (!ready) {
    return <div className="h-72 rounded-3xl border bg-card" aria-busy="true" />
  }

  const open = pages.filter(isUnlocked).length
  const status = open === pages.length ? '已解锁' : open === 0 ? '已锁定' : `已解锁 ${open} / ${pages.length}`

  return (
    <ParentCard
      title={pack.name}
      description={`${pack.description}共 ${pages.length} 页。`}
      badge={
        <div className="flex shrink-0 items-center gap-2">
          {pack.status === 'draft' && (
            <span className="rounded-full border border-dashed px-3 py-1 text-xs font-bold text-muted-foreground">
              草稿
            </span>
          )}
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold',
              open === pages.length ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
            )}
          >
            {status}
          </span>
        </div>
      }
    >
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" aria-label={`${pack.name}中的图画`}>
        {pages.map((mandala) => (
          <li key={mandala.id}>
            <PageTile mandala={mandala} locked={!isUnlocked(mandala)} />
          </li>
        ))}
      </ul>
      {open < pages.length && (
        <Link href={`/parent/billing#${FOR_YOU_ANCHOR}`} className={cn(buttonVariants(), 'h-11 self-start rounded-full px-5 font-bold')}>
          {`以 ${formatPrice(PACK_PRICE_CENTS)} 获取${pack.name}`}
        </Link>
      )}
    </ParentCard>
  )
}

export function GrownUpShelf() {
  if (GROWN_UP_PACKS.length === 0) {
    return (
      <ParentCard
        title="这里还没有内容"
        description="大人画册发布后会出现在这里。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {GROWN_UP_PACKS.map((pack) => (
        <PackSection key={pack.id} pack={pack} />
      ))}
    </div>
  )
}
