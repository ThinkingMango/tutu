'use client'

import { useState } from 'react'
import { LogOut, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { signOutOfDevice, type SignOutChoice } from '@/lib/auth/sign-out'
import { cloudSync, useCloudSync } from '@/lib/cloud-sync/client'
import { cn } from '@/lib/utils'

const plural = (n: number) => (n === 1 ? '1 picture' : `${n} pictures`)

export function SignOutButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setAttempt((n) => n + 1)
          setOpen(true)
          void cloudSync.syncNow()
        }}
        className={cn('h-11 rounded-full px-4 font-bold', className)}
      >
        <LogOut data-icon="inline-start" />
        Sign out
      </Button>
      <SignOutDialog key={attempt} open={open} onOpenChange={setOpen} />
    </>
  )
}

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

function SignOutDialog({ open, onOpenChange }: DialogProps) {
  const { snapshot, summary } = useCloudSync()
  const [choice, setChoice] = useState<SignOutChoice>('remove')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checking = summary.state === 'checking'
  const cloudOn = snapshot.enabled === true
  const offerChoice = cloudOn && summary.saved > 0
  const one = summary.saved === 1

  const signOut = async () => {
    setError(null)
    setPending(true)
    try {
      await signOutOfDevice(offerChoice ? choice : 'keep')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing out didn’t finish. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="gap-5 rounded-3xl p-6 sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Sign out of this device?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            {'This device stops syncing with your account. Choose what happens to your pictures.'}
          </DialogDescription>
        </DialogHeader>

        <div aria-live="polite" className="flex flex-col gap-4">
          {checking ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Checking which pictures are saved in your account…
            </p>
          ) : summary.state === 'off' ? (
            <p className="text-sm leading-relaxed">
              {'Cloud saving is off, so nothing from your account is stored on this device. Your children’s pictures stay here.'}
            </p>
          ) : !cloudOn ? (
            <p className="text-sm leading-relaxed">
              {'We couldn’t reach your account, so every picture stays on this device. You can sign out now, or cancel and try again when you’re online.'}
            </p>
          ) : offerChoice ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 text-sm font-bold">
                {`${plural(summary.saved)} on this device ${summary.saved === 1 ? 'is' : 'are'} saved in your account`}
              </legend>
              <ChoiceOption
                value="remove"
                checked={choice === 'remove'}
                onSelect={setChoice}
                title={`Take ${one ? 'it' : 'them'} off this device`}
                detail={`Best for a shared or school device. ${one ? 'It stays' : 'They stay'} safe in your account and ${one ? 'comes' : 'come'} back when you sign in again. Unfinished pictures stay.`}
              />
              <ChoiceOption
                value="keep"
                checked={choice === 'keep'}
                onSelect={setChoice}
                title={`Keep ${one ? 'it' : 'them'} on this device`}
                detail={`${one ? 'It stays' : 'They stay'} in this device’s garden for anyone who uses it. If another parent signs in here with cloud saving on, ${one ? 'it' : 'they'}’ll be saved to that account.`}
              />
            </fieldset>
          ) : summary.waiting === 0 ? (
            <p className="text-sm leading-relaxed">There are no garden pictures on this device.</p>
          ) : null}

          {cloudOn && summary.waiting > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl bg-warning p-4 text-sm leading-relaxed text-warning-foreground">
              <p className="font-semibold">
                {`${plural(summary.waiting)} ${summary.waiting === 1 ? 'isn’t' : 'aren’t'} saved in your account yet, so ${summary.waiting === 1 ? 'it stays' : 'they stay'} on this device either way.`}
                {summary.state === 'offline' && ' This device is offline.'}
              </p>
              <Button
                variant="outline"
                onClick={() => void cloudSync.syncNow()}
                disabled={summary.state === 'syncing' || pending}
                className="h-10 self-start rounded-full bg-card px-4 font-bold text-foreground"
              >
                <RotateCw data-icon="inline-start" />
                {summary.state === 'syncing' ? 'Saving…' : 'Try saving them now'}
              </Button>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="gap-3">
          <DialogClose
            render={<Button variant="outline" className="h-11 rounded-full px-5 font-bold" />}
            disabled={pending}
          >
            Stay signed in
          </DialogClose>
          <Button onClick={() => void signOut()} disabled={pending || checking} className="h-11 rounded-full px-5 font-bold">
            <LogOut data-icon="inline-start" />
            {pending ? 'Signing out…' : 'Sign out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type ChoiceOptionProps = {
  value: SignOutChoice
  checked: boolean
  onSelect: (value: SignOutChoice) => void
  title: string
  detail: string
}

function ChoiceOption({ value, checked, onSelect, title, detail }: ChoiceOptionProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 has-[:checked]:border-primary has-[:checked]:bg-secondary">
      <input
        type="radio"
        name="sign-out-pictures"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="mt-1 size-4 shrink-0 cursor-pointer accent-primary"
      />
      <span className="flex flex-col gap-1">
        <span className="font-bold">{title}</span>
        <span className="text-sm leading-relaxed text-muted-foreground">{detail}</span>
      </span>
    </label>
  )
}
