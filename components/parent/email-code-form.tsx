'use client'

import { useId, useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth/client'

type Props = {
  email: string
  submitLabel: string
  /** Runs once this device is signed in with the code. */
  onVerified: () => void | Promise<void>
}

/**
 * The emailed link signs in the device that opens it. A parent reading email on their phone types
 * the code from the same email here instead, so the family device signs in.
 */
export function EmailCodeForm({ email, submitLabel, onVerified }: Props) {
  const id = useId()
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await authClient.verifyEmailCode(email, code)
      await onVerified()
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码无效，请再试一次。')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2" noValidate>
      <Label htmlFor={id} className="font-bold">
        邮件在其他设备上打开？请输入其中的验证码。
      </Label>
      <div className="flex flex-wrap gap-3">
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          maxLength={12}
          placeholder="123456"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError(null)
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-11 w-40 rounded-xl text-lg tracking-widest"
        />
        <Button type="submit" variant="outline" disabled={pending} className="h-11 rounded-full px-5 font-bold">
          <KeyRound data-icon="inline-start" />
          {pending ? '正在验证…' : submitLabel}
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-semibold leading-relaxed text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
