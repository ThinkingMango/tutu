'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { Lock, Paintbrush, UsersRound } from 'lucide-react'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { DraftBadge } from '@/components/kid/draft-badge'
import { PackIcon } from '@/components/kid/pack-icon'
import { EMPTY_FILLS } from '@/lib/artwork/library'
import { useEntitlements } from '@/lib/entitlements'
import { latestVersion, type Mandala } from '@/lib/mandalas'
import { packThemeStyle } from '@/lib/pack-theme'
import { KIDS_PACKS, packHref, packPages, type Pack } from '@/lib/packs'
import { cn } from '@/lib/utils'

type IsUnlocked = (mandala: Mandala) => boolean

const GRID = 'grid gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3'

/** A few pages from across the pack, so the cover shows its range rather than only the first pictures. */
function coverPages(pages: Mandala[]) {
  if (pages.length <= 3) return pages
  return [pages[0], pages[Math.floor(pages.length / 2)], pages[pages.length - 1]]
}

function describe(pages: Mandala[], isUnlocked: IsUnlocked) {
  const open = pages.filter(isUnlocked)
  const locked = pages.length - open.length
  const pictures = `${pages.length} 幅图画`
  if (locked === 0) return pictures
  if (open.length === 0) return `${pictures}，全部未解锁`
  const openWord = open.every((m) => m.tier === 'free') ? '免费' : '可涂'
  return `${open.length} 幅${openWord}，${locked} 幅未解锁`
}

function PackCover({ pack, isUnlocked }: { pack: Pack; isUnlocked: IsUnlocked }) {
  const pages = packPages(pack.id)
  const summary = describe(pages, isUnlocked)
  const openCount = pages.filter(isUnlocked).length
  const hasLocked = openCount < pages.length

  return (
    <Link
      href={packHref(pack.id)}
      aria-label={`${pack.name}${pack.status === 'draft' ? '，草稿' : ''}，${summary}`}
      style={packThemeStyle(pack.id)}
      className="pack-theme tactile relative flex h-full flex-col gap-4 rounded-[2.5rem] border-4 border-(--pack) bg-(--pack-tint) p-4 text-ink outline-none [--tactile-edge:var(--pack-edge)] focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4 md:p-5"
    >
      <div className="grid grid-cols-3 gap-2 md:gap-3" aria-hidden="true">
        {coverPages(pages).map((page) => (
          <div key={page.id} className="aspect-square rounded-[1.5rem] bg-card p-2">
            <MandalaArt
              version={latestVersion(page)}
              fills={EMPTY_FILLS}
              className={cn('size-full', !isUnlocked(page) && 'opacity-40')}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <PackIcon id={pack.id} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-black text-balance">{pack.name}</h3>
            <DraftBadge pack={pack} />
          </div>
          <p className="flex items-center gap-2 text-base font-bold text-ink/75">
            {hasLocked && <Lock className="size-4 shrink-0" strokeWidth={2.75} aria-hidden="true" />}
            {summary}
          </p>
        </div>
      </div>
      {openCount === 0 && (
        <span
          className="absolute -top-3 -right-3 flex size-12 items-center justify-center rounded-full border-4 border-background bg-ink text-background"
          aria-hidden="true"
        >
          <Lock className="size-5" strokeWidth={2.75} />
        </span>
      )}
    </Link>
  )
}

type ShelfSectionProps = {
  id: string
  title: string
  icon: ReactNode
  iconClass: string
  note?: string
  packs: readonly Pack[]
  isUnlocked: IsUnlocked
  /** Continues the entrance stagger from the section above. */
  offset?: number
}

function ShelfSection({ id, title, icon, iconClass, note, packs, isUnlocked, offset = 0 }: ShelfSectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span
          className={cn('flex size-12 shrink-0 items-center justify-center rounded-full text-ink', iconClass)}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 id={id} className="text-3xl font-black text-balance">
            {title}
          </h2>
          {note && <p className="text-base font-bold text-muted-foreground text-pretty">{note}</p>}
        </div>
      </div>
      <ul className={GRID} aria-label={title}>
        {packs.map((pack, i) => (
          <li key={pack.id} className="animate-pop-in" style={{ '--i': offset + i } as CSSProperties}>
            <PackCover pack={pack} isUnlocked={isUnlocked} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Same shape as the covers, so nothing jumps when the family's packs finish loading. */
function ShelfPlaceholder() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="正在加载图画包">
      <div className="h-12 w-64 rounded-full bg-secondary" />
      <div className={GRID}>
        {KIDS_PACKS.map((pack) => (
          <div key={pack.id} className="flex flex-col gap-4 rounded-[2.5rem] bg-secondary p-4 md:p-5">
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {[0, 1, 2].map((slot) => (
                <div key={slot} className="aspect-square rounded-[1.5rem] bg-card/70" />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="size-14 shrink-0 rounded-full bg-card/70" />
              <div className="h-7 w-40 rounded-full bg-card/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Packs a child can open come first; the rest wait together behind "Ask a grown-up". */
export function PackShelf() {
  const { ready, isUnlocked } = useEntitlements()

  if (!ready) return <ShelfPlaceholder />

  const open: Pack[] = []
  const locked: Pack[] = []
  for (const pack of KIDS_PACKS) {
    ;(packPages(pack.id).some(isUnlocked) ? open : locked).push(pack)
  }

  return (
    <div className="flex flex-col gap-12">
      <ShelfSection
        id="open-packs"
        title="可以涂色啦"
        icon={<Paintbrush className="size-6" strokeWidth={2.75} />}
        iconClass="bg-swatch-pink"
        packs={open}
        isUnlocked={isUnlocked}
      />
      {locked.length > 0 && (
        <ShelfSection
          id="sleeping-packs"
          title="请大人帮忙"
          icon={<UsersRound className="size-6" strokeWidth={2.75} />}
          iconClass="bg-swatch-sky"
          note="大人可以打开这些图画包。"
          packs={locked}
          isUnlocked={isUnlocked}
          offset={open.length}
        />
      )}
    </div>
  )
}
