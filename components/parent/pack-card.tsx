'use client'

import { Check, Plus } from 'lucide-react'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { PackIcon } from '@/components/kid/pack-icon'
import { Button } from '@/components/ui/button'
import { EMPTY_FILLS } from '@/lib/artwork/library'
import { PACK_PRICE_CENTS, formatPrice } from '@/lib/billing/pricing'
import { latestVersion } from '@/lib/mandalas'
import { packPages, type Pack } from '@/lib/packs'

type PackCardProps = {
  pack: Pack
  /** Why the pack can't be added, when the parent already has it. */
  status: string | null
  selected: boolean
  onToggle: () => void
  /** h4 when the card sits under a group heading such as "For you". */
  headingLevel?: 'h3' | 'h4'
}

export function PackCard({ pack, status, selected, onToggle, headingLevel: Heading = 'h3' }: PackCardProps) {
  const pages = packPages(pack.id)

  return (
    <section
      aria-labelledby={`pack-${pack.id}`}
      className={
        selected
          ? 'flex flex-col gap-5 rounded-3xl border-2 border-primary bg-card p-6'
          : 'flex flex-col gap-5 rounded-3xl border-2 border-border bg-card p-6'
      }
    >
      <header className="flex items-start gap-4">
        <PackIcon id={pack.id} className="size-12 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <Heading id={`pack-${pack.id}`} className="text-xl font-black">
              {pack.name}
            </Heading>
            {status ? (
              <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-foreground">
                <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                {status}
              </span>
            ) : (
              <span className="text-sm font-bold text-muted-foreground">{`单独购买 ${formatPrice(PACK_PRICE_CENTS)}`}</span>
            )}
          </div>
          <p className="text-sm font-bold text-muted-foreground">{`${pages.length} pictures`}</p>
        </div>
      </header>

      <p className="leading-relaxed text-muted-foreground text-pretty">{pack.description}</p>

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8" aria-label={`「${pack.name}」中的图画`}>
        {pages.map((page) => (
          <li key={page.id} className="aspect-square rounded-xl bg-secondary p-1.5" title={page.name}>
            <MandalaArt version={latestVersion(page)} fills={EMPTY_FILLS} className="size-full" />
            <span className="sr-only">{page.name}</span>
          </li>
        ))}
      </ul>

      {!status && (
        <Button
          type="button"
          variant={selected ? 'default' : 'outline'}
          aria-pressed={selected}
          onClick={onToggle}
          className="h-12 self-start rounded-full px-6 text-base font-bold"
        >
          {selected ? <Check data-icon="inline-start" strokeWidth={3} /> : <Plus data-icon="inline-start" strokeWidth={3} />}
          {selected ? '已加入订单' : '加入订单'}
        </Button>
      )}
    </section>
  )
}
