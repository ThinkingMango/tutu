import type { ReactNode } from 'react'
import { Mail } from 'lucide-react'
import { POLICIES_UPDATED, SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/legal'

export function PolicyHeader({ title, intro }: { title: string; intro: ReactNode }) {
  return (
    <header className="flex flex-col gap-3">
      <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{`Updated ${POLICIES_UPDATED}`}</p>
      <h1 className="text-3xl font-black text-balance md:text-4xl">{title}</h1>
      <p className="text-lg leading-relaxed text-muted-foreground text-pretty">{intro}</p>
    </header>
  )
}

export function PolicySection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-xl font-extrabold text-balance">
        {title}
      </h2>
      <div className="flex flex-col gap-3 leading-relaxed text-pretty">{children}</div>
    </section>
  )
}

export function PolicyList({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2 pl-5 [list-style:disc] marker:text-primary">
      {items.map((item, index) => (
        <li key={index} className="pl-1">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function PolicyCard({ children }: { children: ReactNode }) {
  return <article className="flex flex-col gap-8 rounded-3xl border bg-card p-6 md:p-10">{children}</article>
}

export function SupportEmailLink({ href = SUPPORT_MAILTO }: { href?: string }) {
  return (
    <a
      href={href}
      className="font-bold text-primary underline decoration-2 underline-offset-4 outline-none hover:decoration-primary/40 focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {SUPPORT_EMAIL}
    </a>
  )
}

export function ContactPanel({ title, children, href }: { title: string; children: ReactNode; href?: string }) {
  return (
    <aside className="flex flex-col gap-3 rounded-2xl bg-secondary p-5 md:flex-row md:items-center md:gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card" aria-hidden="true">
        <Mail className="size-5 text-primary" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-extrabold">{title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {children} <SupportEmailLink href={href} />
        </p>
      </div>
    </aside>
  )
}
