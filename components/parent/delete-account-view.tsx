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
  '你的登录信息和电子邮箱',
  '孩子图画的所有云端副本',
  '你的云端保存授权记录',
  '你在所有设备上购买的全部画册',
]

type DevicePictures = 'keep' | 'remove'
/** `null` when pictures were kept; otherwise whether removing them from this device worked. */
type Outcome = { removedFromDevice: boolean | null }

const packLabel = (id: string): string[] => {
  if (id === 'standard') return ['标准版解锁']
  const pack = PACK_BY_ID[id as PackId] as (typeof PACK_BY_ID)[PackId] | undefined
  return pack ? [pack.name] : []
}
const plural = (n: number, word: string) => `${n} 张${word}`

export function DeleteAccountView() {
  const auth = useAuthState()
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  if (outcome) return <DeletedPanel outcome={outcome} />

  if (auth.status === 'loading') {
    return <p className="leading-relaxed text-muted-foreground">{'正在确认登录状态…'}</p>
  }

  if (auth.status === 'signed-out') {
    return (
      <section className={PANEL}>
        <p className="leading-relaxed text-muted-foreground">请登录你想删除的账号。</p>
        <Link
          href={`/parent/sign-in?next=${encodeURIComponent(RETURN_PATH)}`}
          className={cn(buttonVariants(), 'h-11 self-start rounded-full px-5 font-bold')}
        >
          <LogIn data-icon="inline-start" />
          登录
        </Link>
      </section>
    )
  }

  return <DeleteAccountForm userId={auth.user.id} email={auth.user.email} onDeleted={setOutcome} />
}

function DeletedPanel({ outcome }: { outcome: Outcome }) {
  const devicePart =
    outcome.removedFromDevice === null
      ? '这台设备上的图画仍然保留，孩子可以继续涂免费的图画。'
      : outcome.removedFromDevice
        ? '这台设备上的图画也已删除。孩子可以继续涂免费的图画。'
        : '我们无法删除这台设备上的图画。请在“概览”页面使用“清除已保存的涂色”来删除。'

  return (
    <section className={PANEL} role="status">
      <CircleCheck className="size-10 text-primary" strokeWidth={2.25} aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-extrabold">你的账号已删除</h2>
        <p className="leading-relaxed text-muted-foreground">
          {`你的登录信息、云端图画、画册和记录都已删除。${devicePart}`}
        </p>
      </div>
      <a href="/" className={cn(buttonVariants(), 'h-11 self-start rounded-full px-5 font-bold')}>
        返回涂色
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
      else setError(err instanceof Error ? err.message : '账号未能删除，请再试一次。')
    } finally {
      setPending(false)
      void cloudSync.resume()
    }
  }

  return (
    <>
      <section className={PANEL} aria-labelledby="what-is-deleted">
        <h2 id="what-is-deleted" className="text-xl font-extrabold">
          会删除哪些内容
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
          {'如果你曾购买画册，出于记账需要，我们会保留每笔付款的记录：金额、日期、画册和付款编号。这些记录不再显示你的邮箱，也不再与你关联。我们的支付服务商 Stripe 会依据其隐私政策保留你的邮箱和付款记录。'}
        </p>
        <p className="leading-relaxed text-muted-foreground">
          {'删除会立即生效，且无法撤销。'}
        </p>
      </section>

      <section className={PANEL} aria-labelledby="device-pictures">
        <h2 id="device-pictures" className="text-xl font-extrabold">
          这台设备上的图画
        </h2>
        {hasPictures ? (
          <fieldset className="flex flex-col gap-3" disabled={pending}>
            <legend className="mb-3 leading-relaxed">
              {`这台设备上有${[
                garden > 0 && `“我的花园”里的 ${plural(garden, '图画')}`,
                unfinished > 0 && `${plural(unfinished, '未完成的图画')}`,
              ]
                .filter(Boolean)
                .join('和')}。请选择如何处理它们。`}
            </legend>
            <DeviceOption
              value="keep"
              checked={devicePictures === 'keep'}
              onSelect={setDevicePictures}
              title="保留在这台设备上"
              detail="孩子仍然可以查看和涂色。使用这台设备的任何人也都能看到。"
            />
            <DeviceOption
              value="remove"
              checked={devicePictures === 'remove'}
              onSelect={setDevicePictures}
              title="从这台设备上删除"
              detail="适合共用设备或学校设备。由于云端副本会随账号一起删除，这些图画将永久消失。你其他设备上的图画会保留。"
            />
          </fieldset>
        ) : (
          <p className="leading-relaxed text-muted-foreground">这台设备上没有已保存的图画。</p>
        )}
      </section>

      <section className={PANEL} aria-labelledby="confirm-deletion">
        <h2 id="confirm-deletion" className="text-xl font-extrabold">
          确认
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
                {'输入 '}
                <span className="break-all">{email}</span>
                {' 以确认'}
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
              {pending ? '正在删除…' : '删除我的账号'}
            </Button>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {`本次登录大约还剩 ${Math.max(1, Math.round(remainingMs / 60_000))} 分钟。`}
            </p>
          </form>
        ) : (
          <FreshSignInPrompt email={email} action="删除你的账号" returnPath={RETURN_PATH} />
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
        已购买的画册将永久锁定
      </p>
      <p>
        {'删除账号后，所有付费画册会在所有设备上立即锁定。由于购买记录不再与你关联，即使用同一邮箱重新注册也无法恢复。'}
      </p>
      {owned.length > 0 && (
        <p>
          <span className="font-bold">{'你将失去：'}</span>
          {owned.join('、')}。
        </p>
      )}
      <p>
        {`想要退款？请在删除账号之前申请。购买后 ${REFUND_WINDOW_DAYS} 天内可无理由全额退款。超过期限后，`}
        <Link href={REFUNDS_HREF} className={LINK}>
          退款政策
        </Link>
        {'说明了我们在哪些情况下仍可提供帮助。'}
      </p>
      <a
        href={supportMailto('退款申请')}
        className={cn(buttonVariants({ variant: 'outline' }), 'h-10 self-start rounded-full bg-card px-4 font-bold text-foreground')}
      >
        申请退款
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
