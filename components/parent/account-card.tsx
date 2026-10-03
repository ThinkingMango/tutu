'use client'

import Link from 'next/link'
import { ParentCard } from '@/components/parent/parent-card'
import { SignOutButton } from '@/components/parent/sign-out-button'
import { buttonVariants } from '@/components/ui/button'
import { useAuthState } from '@/lib/auth/client'
import { cn } from '@/lib/utils'

const DESCRIPTIONS = {
  loading: '正在检查登录状态…',
  'signed-in': '已通过邮件链接或验证码在这台设备上登录。',
  'signed-out': '登录后即可购买画册，并在每台设备上使用。',
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
            删除账号
          </Link>
        </div>
      ) : auth.status === 'signed-out' ? (
        <Link
          href="/parent/sign-in"
          className={cn(buttonVariants(), 'h-11 self-start rounded-full px-5 font-bold')}
        >
          登录
        </Link>
      ) : null}
    </ParentCard>
  )
}
