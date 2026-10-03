'use client'

import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
import { ParentCard } from '@/components/parent/parent-card'
import { buttonVariants } from '@/components/ui/button'
import { useEntitlements } from '@/lib/entitlements'
import { GROWN_UP_PACKS, KIDS_PACKS, packHref, packPages, type Pack } from '@/lib/packs'
import { cn } from '@/lib/utils'

type Row = { pack: Pack; total: number; open: number }

function PackRows({ rows, label }: { rows: Row[]; label: string }) {
  return (
    <ul className="flex flex-col divide-y" aria-label={label}>
      {rows.map(({ pack, total, open }) => {
        const isOpen = open === total
        const status = isOpen ? '已解锁' : open === 0 ? '已锁定' : `${open} / ${total} 张免费`
        return (
          <li key={pack.id} className="py-1 first:pt-0 last:pb-0">
            {/* A plain link: most packs open on the children's screens, which need a fresh page. */}
            <a
              href={packHref(pack.id)}
              className="-mx-2 flex min-h-12 items-center justify-between gap-4 rounded-xl px-2 py-1 transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-bold">{pack.name}</span>
                <span className="text-sm text-muted-foreground">{`${total} 张图画`}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isOpen ? (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Check className="size-4" aria-hidden="true" />
                    {status}
                  </span>
                ) : (
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
                    {status}
                  </span>
                )}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

export function PlanSummaryCard() {
  const { isUnlocked } = useEntitlements()
  const toRow = (pack: Pack): Row => {
    const pages = packPages(pack.id)
    return { pack, total: pages.length, open: pages.filter(isUnlocked).length }
  }
  const kidRows = KIDS_PACKS.map(toRow)
  const grownUpRows = GROWN_UP_PACKS.map(toRow)
  const rows = [...kidRows, ...grownUpRows]
  const packsOpen = rows.filter((r) => r.open === r.total).length
  const allOpen = packsOpen === rows.length

  return (
    <ParentCard title="画册" description={`${rows.length} 本画册中已完全解锁 ${packsOpen} 本`}>
      {grownUpRows.length === 0 ? (
        <PackRows rows={kidRows} label="画册及解锁情况" />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">给孩子</h3>
            <PackRows rows={kidRows} label="儿童画册及解锁情况" />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">给你自己</h3>
            <PackRows rows={grownUpRows} label="大人画册及解锁情况" />
          </div>
        </div>
      )}
      {!allOpen && (
        <Link href="/parent/billing" className={cn(buttonVariants(), 'h-11 self-start rounded-full px-5 font-bold')}>
          获取更多画册
        </Link>
      )}
    </ParentCard>
  )
}
