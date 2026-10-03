'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, MailCheck } from 'lucide-react'
import { EmailCodeForm } from '@/components/parent/email-code-form'
import { SignOutButton } from '@/components/parent/sign-out-button'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient, useAuthState } from '@/lib/auth/client'
import { cn } from '@/lib/utils'

const RESEND_COOLDOWN_SECONDS = 60

export type LinkError = 'expired' | 'link'

const LINK_ERROR_MESSAGES: Record<LinkError, string> = {
  expired: '这个登录链接已过期或已被使用。请在下方重新发送一个。',
  link: '这个登录链接无效。如果你请求了多次，只有最新的一封有效。请在下方重新发送一个。',
}

export function SignInForm({ next, linkError }: { next: string; linkError: LinkError | null }) {
  const auth = useAuthState()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [error, setError] = useState<string | null>(linkError ? LINK_ERROR_MESSAGES[linkError] : null)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const sendLink = async (address: string) => {
    setError(null)
    setPending(true)
    try {
      await authClient.sendEmailLink(address, next)
      setSentTo(address.trim().toLowerCase())
      setSecondsLeft(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setError(err instanceof Error ? err.message : '出了点问题，请再试一次。')
    } finally {
      setPending(false)
    }
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void sendLink(email)
  }

  const errorMessage = error && (
    <p role="alert" className="text-sm font-semibold leading-relaxed text-destructive">
      {error}
    </p>
  )

  if (auth.status === 'loading') {
    return (
      <p aria-live="polite" className="leading-relaxed text-muted-foreground">
        {'正在确认登录状态…'}
      </p>
    )
  }

  if (auth.status === 'signed-in') {
    return (
      <div className="flex flex-col gap-5">
        <p className="leading-relaxed">
          {'当前登录账号：'}
          <span className="font-bold break-all">{auth.user.email}</span>
          {'。'}
        </p>
        {errorMessage}
        <div className="flex flex-wrap gap-3">
          <Link href={next} className={cn(buttonVariants(), 'h-11 rounded-full px-5 font-bold')}>
            继续
          </Link>
          <SignOutButton className="px-5" />
        </div>
      </div>
    )
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4" aria-live="polite">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1 text-sm leading-relaxed">
            <p className="font-bold">请查收邮件</p>
            <p>
              {'我们已将登录链接和验证码发送到 '}
              <span className="font-bold break-all">{sentTo}</span>
              {'。请在这台设备上点击链接，或在下方输入验证码。每个只能使用一次，且只有最新的邮件有效。'}
            </p>
          </div>
        </div>
        <EmailCodeForm email={sentTo} submitLabel="登录" onVerified={() => router.replace(next)} />
        {errorMessage}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => void sendLink(sentTo)}
            disabled={pending || secondsLeft > 0}
            className="h-11 rounded-full px-5 font-bold"
          >
            {pending ? '正在发送…' : secondsLeft > 0 ? `${secondsLeft} 秒后可重新发送` : '重新发送'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSentTo(null)
              setError(null)
            }}
            className="h-11 rounded-full px-5 font-bold"
          >
            使用其他邮箱
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {errorMessage}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="font-bold">
          电子邮箱
        </Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-xl text-base"
          placeholder="you@example.com"
        />
      </div>

      <Button type="submit" disabled={pending} className="h-12 rounded-full text-base font-bold">
        <Mail data-icon="inline-start" />
        {pending ? '正在发送…' : '发送登录链接和验证码到我的邮箱'}
      </Button>

      <p className="text-sm leading-relaxed text-muted-foreground">
        无需密码。第一次使用？同一个链接会为你创建家长账号。
      </p>
    </form>
  )
}
