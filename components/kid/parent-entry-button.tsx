import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

/** Deliberately quiet next to the children's controls. The label folds away on phones. */
export function ParentEntryButton() {
  return (
    <Link
      href="/parent"
      aria-label="Grown-ups area"
      title="Grown-ups"
      className="flex h-14 shrink-0 items-center gap-2 rounded-full border-2 border-border bg-background px-4 text-base font-bold text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring md:px-5"
    >
      <ShieldCheck className="size-5" strokeWidth={2.5} aria-hidden="true" />
      <span className="hidden md:inline">Grown-ups</span>
    </Link>
  )
}
