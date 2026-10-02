import type { Pack } from '@/lib/packs'

/** Marks a pack that isn't published yet. Drafts are only listed while developing. */
export function DraftBadge({ pack }: { pack: Pack }) {
  if (pack.status !== 'draft') return null
  return (
    <span className="shrink-0 rounded-full border-2 border-dashed border-muted-foreground px-3 py-0.5 text-sm font-black tracking-wider text-muted-foreground uppercase">
      Draft
    </span>
  )
}
