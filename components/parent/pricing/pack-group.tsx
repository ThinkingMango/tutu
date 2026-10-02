import { useId, type ReactNode } from 'react'

type PackGroupProps = {
  /** No title renders the cards alone, for when there is only one audience to sell to. */
  title: string | null
  description: string
  /** Anchor so other pages can link straight to this group. */
  id?: string
  children: ReactNode
}

export function PackGroup({ title, description, id, children }: PackGroupProps) {
  const headingId = useId()

  if (!title) return <div className="flex flex-col gap-4">{children}</div>

  return (
    <section id={id} aria-labelledby={headingId} className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id={headingId} className="text-xl font-black">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
      </div>
      {children}
    </section>
  )
}
