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
      setError(err instanceof Error ? err.message : 'We couldn’t send the email. Please try again.')
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
              <p className="font-bold">Check your email</p>
              <p>
                {'We sent a fresh link and code to '}
                <span className="font-bold break-all">{email}</span>
                {`. Open the link in this browser, or type the code below. You then have 10 minutes to ${action}.`}
              </p>
            </>
          ) : (
            <>
              <p className="font-bold">Confirm it’s you with a fresh sign-in email</p>
              <p>
                {`To protect your child, only a grown-up who signed in during the last 10 minutes can ${action}. This stops anyone using an already signed-in family device from doing it.`}
              </p>
            </>
          )}
        </div>
      </div>
      {sent && <EmailCodeForm email={email} submitLabel="Confirm" onVerified={refreshRecentSignIn} />}
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
          ? 'Sending…'
          : secondsLeft > 0
            ? `Send again in ${secondsLeft}s`
            : sent
              ? 'Send again'
              : 'Email me a link and code'}
      </Button>
    </div>
  )
}
