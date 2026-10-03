'use client'

import { useEffect, useState } from 'react'
import { Mail, MailCheck, ShieldCheck } from 'lucide-react'
import { EmailCodeForm } from '@/components/parent/email-code-form'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'
import { refreshRecentSignIn } from '@/lib/auth/recent-sign-in'

const RESEND_COOLDOWN_SECONDS = 60

/** `action` completes "only a grown-up who signed in recently can …", e.g. "turn on cloud saving". */
type Props = { email: string; action: string; returnPath: string }

export function FreshSignInPrompt({ email, action, returnPath }: Props) {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const send = async () => {
    setError(null)
    setPending(true)
    try {
      await authClient.sendEmailLink(email, returnPath)
      setSent(true)
      setSecondsLeft(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setError(err instanceof Error ? err.message : '邮件发送失败，请再试一次。')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-secondary p-5">
      <div className="flex items-start gap-3">
        {sent ? (
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        )}
        <div className="flex flex-col gap-1 text-sm leading-relaxed" aria-live="polite">
          {sent ? (
            <>
              <p className="font-bold">请查收邮件</p>
              <p>
                {'我们已将新的链接和验证码发送到 '}
                <span className="font-bold break-all">{email}</span>
                {`。请在这个浏览器中打开链接，或在下方输入验证码。之后你有 10 分钟时间${action}。`}
              </p>
            </>
          ) : (
            <>
              <p className="font-bold">通过新的登录邮件确认是你本人</p>
              <p>
                {`为了保护孩子，只有在最近 10 分钟内登录的大人才能${action}。这样可以防止他人用已登录的家庭设备进行此操作。`}
              </p>
            </>
          )}
        </div>
      </div>
      {sent && <EmailCodeForm email={email} submitLabel="确认" onVerified={refreshRecentSignIn} />}
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <Button
        onClick={() => void send()}
        disabled={pending || secondsLeft > 0}
        className="h-11 self-start rounded-full px-5 font-bold"
      >
        <Mail data-icon="inline-start" />
        {pending
          ? '正在发送…'
          : secondsLeft > 0
            ? `${secondsLeft} 秒后可重新发送`
            : sent
              ? '重新发送'
              : '发送链接和验证码到我的邮箱'}
      </Button>
    </div>
  )
}
