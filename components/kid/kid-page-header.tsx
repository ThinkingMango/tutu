import type { ReactNode } from 'react'
import { House } from 'lucide-react'
import { ToolLink } from '@/components/coloring/tool-button'
import { ParentEntryButton } from '@/components/kid/parent-entry-button'

type KidPageHeaderProps = {
  title: string
  /** The page's round crayon icon, hidden on the narrowest phones to leave room for the title. */
  icon: ReactNode
  extra?: ReactNode
}

/** A band in the page's crayon (set with `pack-theme` on a parent), with the way home always first. */
export function KidPageHeader({ title, icon, extra }: KidPageHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 rounded-[2.5rem] border-4 border-(--pack) bg-(--pack-tint) p-3 text-ink md:gap-4 md:p-4">
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        <ToolLink href="/" label="Home" icon={<House strokeWidth={2.5} />} variant="inset" />
        <span className="hidden sm:contents">{icon}</span>
        <h1 className="min-w-0 text-3xl font-black text-balance md:text-4xl">{title}</h1>
        {extra}
      </div>
      <ParentEntryButton />
    </header>
  )
}
