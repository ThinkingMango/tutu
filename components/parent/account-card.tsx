'use client'

import Link from 'next/link'
import { ParentCard } from '@/components/parent/parent-card'
import { SignOutButton } from '@/components/parent/sign-out-button'
import { buttonVariants } from '@/components/ui/button'
import { useAuthState } from '@/lib/auth/client'
import { cn } from '@/lib/utils'

const DESCRIPTIONS = {
  loading: 'Checking sign-in…',
  'signed-in': 'Signed in on this device with an email link or code.',
  'signed-out': 'Sign in to buy packs and open them on every device.',
} as const

export function AccountCard() {
  const auth = useAuthState()

  return (
    <ParentCard title="Account" description={DESCRIPTIONS[auth.status]}>
      {auth.status === 'signed-in' ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-primary-foreground"
                aria-hidden="true"
              >
                {auth.user.email.charAt(0).toUpperCase()}
              </span>
              <span className="truncate font-bold">{auth.user.email}</span>
            </div>
            <SignOutButton />
          </div>
          <Link
            href="/parent/delete-account"
            className="self-start text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-destructive"
          >
            Delete account
          </Link>
        </div>
      ) : auth.status === 'signed-out' ? (
        <Link
          href="/parent/sign-in"
          className={cn(buttonVariants(), 'h-11 self-start rounded-full px-5 font-bold')}
        >
          Sign in
        </Link>
      ) : null}
    </ParentCard>
  )
}
