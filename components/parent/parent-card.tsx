import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ParentCardProps = {
  title: string
  description?: ReactNode
  badge?: ReactNode
  children?: ReactNode
  className?: string
  id?: string
}

export function ParentCard({ title, description, badge, children, className, id }: ParentCardProps) {
  return (
    <section id={id} className={cn('flex scroll-mt-28 flex-col gap-5 rounded-3xl border bg-card p-6', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-extrabold">{title}</h2>
          {description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {badge}
      </header>
      {children}
    </section>
  )
}
