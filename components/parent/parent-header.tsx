'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { useAuthState } from '@/lib/auth/client'
import { buttonVariants } from '@/components/ui/button'
import { parentGateStore } from '@/lib/device-stores'
import { useLocalStore } from '@/lib/local-store'
import { GROWN_UP_PACKS, GROWN_UPS_HREF } from '@/lib/packs'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/parent/home', label: '概览' },
  { href: '/parent/pictures', label: '图画' },
  ...(GROWN_UP_PACKS.length > 0 ? [{ href: GROWN_UPS_HREF, label: '你的涂色' }] : []),
  { href: '/parent/billing', label: '价格' },
  { href: '/parent/cloud-saving', label: '云端保存' },
]

export function ParentHeader() {
  const pathname = usePathname()
  const passed = useLocalStore(parentGateStore)
  const auth = useAuthState()
  const showNav = passed && pathname !== '/parent'
  const nav = auth.status === 'signed-out' ? [...NAV, { href: '/parent/sign-in', label: '登录' }] : NAV

  return (
    <header className="sticky top-0 z-20 border-b bg-background print:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <BrandMark compact />
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            家长
          </span>
        </div>

        {showNav && (
          <nav
            aria-label="家长区域"
            className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 md:order-none md:mx-0 md:w-auto md:px-0"
          >
            {nav.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-2.5 text-sm font-bold whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                    active
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        )}

        {/* A plain link, so the children's screens start a fresh page without grown-up scripts. */}
        <a
          href="/"
          className={cn(buttonVariants({ variant: 'outline' }), 'h-11 rounded-full px-4 text-sm font-bold')}
        >
          <ArrowLeft data-icon="inline-start" />
          返回涂色
        </a>
      </div>
    </header>
  )
}
