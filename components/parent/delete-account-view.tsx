'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CircleCheck, Lock, LogIn, Trash2 } from 'lucide-react'
import { FreshSignInPrompt } from '@/components/parent/fresh-sign-in-prompt'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useArtworkLibrary } from '@/hooks/use-artwork-library'
import { useNow } from '@/hooks/use-now'
import { AccountDeletionError, deleteAccount } from '@/lib/account/client'
import { authClient, useAuthState } from '@/lib/auth/client'
import { useRecentSignIn } from '@/lib/auth/recent-sign-in'
import { freshSignInRemainingMs } from '@/lib/cloud-consent/notice'
import { cloudSync } from '@/lib/cloud-sync/client'
import { useEntitlements } from '@/lib/entitlements'
import { REFUND_WINDOW_DAYS, REFUNDS_HREF, supportMailto } from '@/lib/legal'
import { PACK_BY_ID, type PackId } from '@/lib/packs'
import { cn } from '@/lib/utils'

const PANEL = 'flex flex-col gap-5 rounded-3xl border bg-card p-6 md:p-8'
const RETURN_PATH = '/parent/delete-account'
const LINK = 'font-bold underline decoration-2 underline-offset-4 outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50'

const DELETED = [
  'Your sign-in and email address',
  'Every cloud copy of your child’s pictures',
  'Your cloud saving permission records',
  'Every pack you bought, on every device',
]

type DevicePictures = 'keep' | 'remove'
/** `null` when pictures were kept; otherwise whether removing them from this device worked. */
type Outcome = { removedFromDevice: boolean | null }

const packLabel = (id: string): string[] => {
  if (id === 'standard') return ['the Standard unlock']
  const pack = PACK_BY_ID[id as PackId] as (typeof PACK_BY_ID)[PackId] | undefined
  return pack ? [pack.name] : []
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function DeleteAccountView() {
  const auth = useAuthState()
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  if (outcome) return <DeletedPanel outcome={outcome} />

  if (auth.status === 'loading') {
    return <p className="leading-relaxed text-muted-foreground">{'Checking whether you’re signed in…'}</p>
  }

  if (auth.status === 'signed-out') {
    return (
      <section className={PANEL}>
        <p className="leading-relaxed text-muted-foreground">Sign in to the account you want to delete.</p>
        <Link
          href={`/parent/sign-in?next=${encodeURIComponent(RETURN_PATH)}`}
          className={cn(buttonVariants(), 'h-11 self-start rounded-full px-5 font-bold')}
        >
          <LogIn data-icon="inline-start" />
          Sign in
        </Link>
      </section>
    )
  }

  return <DeleteAccountForm userId={auth.user.id} email={auth.user.email} onDeleted={setOutcome} />
}

function DeletedPanel({ outcome }: { outcome: Outcome }) {
  const devicePart =
    outcome.removedFromDevice === null
      ? 'Pictures on this device are still here, and your child can keep coloring the free pages.'
      : outcome.removedFromDevice
        ? 'The pictures on this device were removed too. Your child can keep coloring the free pages.'
        : 'We couldn’t remove the pictures on this device. Use Clear saved coloring on the Overview page to remove them.'

  return (
    <section className={PANEL} role="status">
      <CircleCheck className="size-10 text-primary" strokeWidth={2.25} aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-extrabold">Your account was deleted</h2>
        <p className="leading-relaxed text-muted-foreground">
          {`Your sign-in, cloud pictures, packs and records are gone. ${devicePart}`}
        </p>
      </div>
      <a href="/" className={cn(buttonVariants(), 'h-11 self-start rounded-full px-5 font-bold')}>
        Back to coloring
      </a>
    </section>
  )
}

type FormProps = { userId: string; email: string; onDeleted: (outcome: Outcome) => void }

function DeleteAccountForm({ userId, email, onDeleted }: FormProps) {
  const { data: signedInAt } = useRecentSignIn(userId)
  const now = useNow()
  const { library, state } = useArtworkLibrary()
  const [typed, setTyped] = useState('')
  const [devicePictures, setDevicePictures] = useState<DevicePictures>('keep')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverSaysStale, setServerSaysStale] = useState(false)

  const remainingMs = freshSignInRemainingMs(signedInAt ?? null, now)
  const fresh = remainingMs > 0 && !serverSaysStale
  const matches = typed.trim().toLowerCase() === email.toLowerCase()
  const garden = state.gallery.length
  const unfinished = Object.keys(state.drafts).length
  const hasPictures = garden + unfinished > 0

  const remove = async () => {
    setError(null)
    setPending(true)
    await cloudSync.pause()
    try {
      await deleteAccount(typed)
      cloudSync.setParent(null)
      const removedFromDevice = hasPictures && devicePictures === 'remove' ? library.clearAll() : null
      onDeleted({ removedFromDevice })
      await authClient.signOut().catch(() => {})
    } catch (err) {
      if (err instanceof AccountDeletionError && err.code === 'recent_sign_in_required') setServerSaysStale(true)
      else setError(err instanceof Error ? err.message : 'Your account wasn’t deleted. Please try again.')
    } finally {
      setPending(false)
      void cloudSync.resume()
    }
  }

  return (
    <>
      <section className={PANEL} aria-labelledby="what-is-deleted">
        <h2 id="what-is-deleted" className="text-xl font-extrabold">
          What gets deleted
        </h2>
        <ul className="flex flex-col gap-2">
          {DELETED.map((item) => (
            <li key={item} className="flex items-start gap-3 leading-relaxed">
              <Trash2 className="mt-1 size-4 shrink-0 text-destructive" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <PacksWarning />
        <p className="leading-relaxed text-muted-foreground">
          {'If you ever bought a pack, we keep a record of each payment for accounting: the amount, date, packs and payment number. It no longer shows your email or links to you. Stripe, our payment provider, keeps your email address and payment history under its own privacy policy.'}
        </p>
        <p className="leading-relaxed text-muted-foreground">
          {'Deletion happens right away and can’t be undone.'}
        </p>
      </section>

      <section className={PANEL} aria-labelledby="device-pictures">
        <h2 id="device-pictures" className="text-xl font-extrabold">
          Pictures on this device
        </h2>
        {hasPictures ? (
          <fieldset className="flex flex-col gap-3" disabled={pending}>
            <legend className="mb-3 leading-relaxed">
              {`This device has ${[
                garden > 0 && `${plural(garden, 'picture')} in My garden`,
                unfinished > 0 && `${plural(unfinished, 'unfinished picture')}`,
              ]
                .filter(Boolean)
                .join(' and ')}. Choose what happens to them.`}
            </legend>
            <DeviceOption
              value="keep"
              checked={devicePictures === 'keep'}
              onSelect={setDevicePictures}
              title="Keep them on this device"
              detail="Your child can still see and color them. Anyone who uses this device can see them too."
            />
            <DeviceOption
              value="remove"
              checked={devicePictures === 'remove'}
              onSelect={setDevicePictures}
              title="Remove them from this device"
              detail="Best for a shared or school device. They’re gone for good, because the cloud copies are deleted with your account. Pictures on your other devices stay there."
            />
          </fieldset>
        ) : (
          <p className="leading-relaxed text-muted-foreground">There are no saved pictures on this device.</p>
        )}
      </section>

      <section className={PANEL} aria-labelledby="confirm-deletion">
        <h2 id="confirm-deletion" className="text-xl font-extrabold">
          Confirm
        </h2>
        {fresh ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (matches && !pending) void remove()
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-email" className="flex-wrap font-bold">
                {'Type '}
                <span className="break-all">{email}</span>
                {' to confirm'}
              </Label>
              <Input
                id="confirm-email"
                type="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <Button
              type="submit"
              variant="destructive"
              disabled={!matches || pending}
              className="h-12 self-start rounded-full px-6 text-base font-bold"
            >
              <Trash2 data-icon="inline-start" />
              {pending ? 'Deleting…' : 'Delete my account'}
            </Button>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {`You have about ${Math.max(1, Math.round(remainingMs / 60_000))} min left with this sign-in.`}
            </p>
          </form>
        ) : (
          <FreshSignInPrompt email={email} action="delete your account" returnPath={RETURN_PATH} />
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
      </section>
    </>
  )
}

function PacksWarning() {
  const { packs } = useEntitlements()
  const owned = [...packs].flatMap(packLabel)

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-warning p-4 leading-relaxed text-warning-foreground md:p-5">
      <p className="flex items-center gap-2 font-extrabold">
        <Lock className="size-4 shrink-0" aria-hidden="true" />
        Packs you bought lock for good
      </p>
      <p>
        {'Deleting your account locks every paid pack straight away, on every device. They can’t be restored, not even if you sign up again with the same email, because your purchases are no longer linked to you.'}
      </p>
      {owned.length > 0 && (
        <p>
          <span className="font-bold">{'You’ll lose: '}</span>
          {owned.join(', ')}.
        </p>
      )}
      <p>
        {`Would you rather have your money back? Ask for a refund before you delete your account. Within ${REFUND_WINDOW_DAYS} days of buying you get a full refund, no questions asked. After that, the `}
        <Link href={REFUNDS_HREF} className={LINK}>
          refund policy
        </Link>
        {' explains when we can still help.'}
      </p>
      <a
        href={supportMailto('Refund request')}
        className={cn(buttonVariants({ variant: 'outline' }), 'h-10 self-start rounded-full bg-card px-4 font-bold text-foreground')}
      >
        Ask for a refund
      </a>
    </div>
  )
}

type DeviceOptionProps = {
  value: DevicePictures
  checked: boolean
  onSelect: (value: DevicePictures) => void
  title: string
  detail: string
}

function DeviceOption({ value, checked, onSelect, title, detail }: DeviceOptionProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <input
        type="radio"
        name="device-pictures"
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
