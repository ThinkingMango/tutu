'use client'

import { Check, Lock, Plus } from 'lucide-react'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { PackIcon } from '@/components/kid/pack-icon'
import { Button } from '@/components/ui/button'
import { EMPTY_FILLS } from '@/lib/artwork/library'
import { STANDARD_UNLOCK_CENTS, formatPrice } from '@/lib/billing/pricing'
import { latestVersion } from '@/lib/mandalas'
import { packPages } from '@/lib/packs'

type StandardUnlockCardProps = {
  unlocked: boolean
  selected: boolean
  onToggle: () => void
}

export function StandardUnlockCard({ unlocked, selected, onToggle }: StandardUnlockCardProps) {
  const pages = packPages('standard')
  const free = pages.filter((page) => page.tier === 'free').length
  const locked = pages.length - free

  return (
    <section
      aria-labelledby="standard-unlock"
      className={
        selected
          ? 'flex flex-col gap-5 rounded-3xl border-2 border-primary bg-card p-6'
          : 'flex flex-col gap-5 rounded-3xl border-2 border-border bg-card p-6'
      }
    >
      <header className="flex items-start gap-4">
        <PackIcon id="standard" className="size-12 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 id="standard-unlock" className="text-xl font-black">
              解锁完整标准画册
            </h3>
            {unlocked ? (
              <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-foreground">
                <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                已解锁
              </span>
            ) : (
              <span className="text-sm font-bold text-muted-foreground">{`一次性 ${formatPrice(STANDARD_UNLOCK_CENTS)}`}</span>
            )}
          </div>
          <p className="text-sm font-bold text-muted-foreground">{`再解锁 ${locked} 张花朵图画`}</p>
        </div>
      </header>

      <p className="leading-relaxed text-muted-foreground text-pretty">
        {`前 ${free} 朵花和全部十二种颜色对所有人免费。购买后将解锁其余 ${locked} 朵。`}
      </p>

      <ul className="grid grid-cols-5 gap-2 sm:grid-cols-10" aria-label="标准画册中的图画">
        {pages.map((page) => {
          const open = unlocked || page.tier === 'free'
          return (
            <li
              key={page.id}
              className="relative flex aspect-square items-center justify-center rounded-xl bg-secondary p-1.5"
              title={page.name}
            >
              <MandalaArt
                version={latestVersion(page)}
                fills={EMPTY_FILLS}
                className={open ? 'size-full' : 'size-full opacity-30'}
              />
              {!open && <Lock className="absolute size-4 text-foreground" strokeWidth={2.75} aria-hidden="true" />}
              <span className="sr-only">{`${page.name}: ${page.tier === 'free' ? 'free' : open ? 'unlocked' : 'locked'}`}</span>
            </li>
          )
        })}
      </ul>

      {!unlocked && (
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
