'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { INFO_LINKS, OPERATOR_NAME, SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/legal'
import { cn } from '@/lib/utils'

export function InfoFooter() {
  const pathname = usePathname()

  return (
    <footer className="mt-auto border-t bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-6 md:flex-row md:items-center md:justify-between md:px-8">
        <nav aria-label="政策与帮助" className="-mx-3 flex flex-wrap gap-1">
          {INFO_LINKS.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-full px-3 py-2 text-sm font-bold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
        <p className="text-sm text-muted-foreground">
          {`漫涂涂 · 由 ${OPERATOR_NAME} 提供 · `}
          <a
            href={SUPPORT_MAILTO}
            className="font-bold underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </footer>
  )
}
