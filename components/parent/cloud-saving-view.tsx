'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Cloud, CloudOff, LogIn, RotateCw } from 'lucide-react'
import { CloudSyncStatus } from '@/components/parent/cloud-sync-status'
import { ConsentNoticeArticle, NoticeSections, formatConsentDate } from '@/components/parent/consent-notice'
import { ConsentReceiptButton } from '@/components/parent/consent-receipt-button'
import { FreshSignInPrompt } from '@/components/parent/fresh-sign-in-prompt'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useNow } from '@/hooks/use-now'
import { useAuthState } from '@/lib/auth/client'
import {
  CloudConsentError,
  disableCloudSaving,
  giveCloudConsent,
  removeCloudFiles,
  useCloudConsent,
  type ActiveConsent,
  type ConsentNotice,
} from '@/lib/cloud-consent/client'
import { NOTICE_CHANGES, agreementStatement, freshSignInRemainingMs } from '@/lib/cloud-consent/notice'
import { cloudSync } from '@/lib/cloud-sync/client'
import { cn } from '@/lib/utils'

const PANEL = 'flex flex-col gap-5 rounded-3xl border bg-card p-6 md:p-8'
const RETURN_PATH = '/parent/cloud-saving'

type Flash = { kind: 'success' | 'files_remaining'; message: string }

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : '操作没有成功，请再试一次。'
}

function minutes(ms: number) {
  return Math.max(1, Math.round(ms / 60_000))
}

export function CloudSavingView() {
  const auth = useAuthState()

  if (auth.status === 'loading') {
    return <p className="leading-relaxed text-muted-foreground">{'正在确认登录状态…'}</p>
  }

  if (auth.status === 'signed-out') {
    return (
      <section className={PANEL}>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-extrabold">登录后即可开启云端保存</h2>
          <p className="leading-relaxed text-muted-foreground">
            云端保存需要家长账号。在此之前，图画只保存在这台设备上。
          </p>
        </div>
        <Link
          href={`/parent/sign-in?next=${encodeURIComponent('/parent/cloud-saving')}`}
          className={cn(buttonVariants(), 'h-11 self-start rounded-full px-5 font-bold')}
        >
          <LogIn data-icon="inline-start" />
          登录
        </Link>
      </section>
    )
  }

  return <SignedInCloudSaving userId={auth.user.id} email={auth.user.email} />
}

function SignedInCloudSaving({ userId, email }: { userId: string; email: string }) {
  const { data, error, isValidating, mutate } = useCloudConsent(userId)
  const now = useNow()
  const [flash, setFlash] = useState<Flash | null>(null)
  const [retrying, setRetrying] = useState(false)

  const retryFileRemoval = async () => {
    setRetrying(true)
    try {
      await removeCloudFiles(userId)
      setFlash({ kind: 'success', message: '所有云端图画文件都已删除。' })
    } catch (err) {
      setFlash({ kind: 'files_remaining', message: errorMessage(err) })
    } finally {
      setRetrying(false)
    }
  }

  if (error && !data) {
    return (
      <section className={PANEL}>
        <p role="alert" className="leading-relaxed font-semibold text-destructive">
          {errorMessage(error)}
        </p>
        <Button
          variant="outline"
          onClick={() => void mutate()}
          disabled={isValidating}
          className="h-11 self-start rounded-full px-5 font-bold"
        >
          <RotateCw data-icon="inline-start" />
          再试一次
        </Button>
      </section>
    )
  }

  if (!data) {
    return <p className="leading-relaxed text-muted-foreground">正在加载云端保存…</p>
  }

  if (!data.notice) {
    return (
      <section className={PANEL}>
        <h2 className="text-xl font-extrabold">{'云端保存暂未开放'}</h2>
        <p className="leading-relaxed text-muted-foreground">
          图画只保存在这台设备上，不会发送到任何地方。
        </p>
      </section>
    )
  }

  const remainingMs = freshSignInRemainingMs(data.signedInAt, now)
  const signedInMinutesAgo = data.signedInAt ? minutes(now - data.signedInAt.getTime()) : null
  const onChanged = async (next: Flash | null) => {
    setFlash(next)
    await mutate()
  }

  return (
    <div className="flex flex-col gap-6">
      {flash && (
        <div
          role={flash.kind === 'success' ? 'status' : 'alert'}
          className={cn(
            'flex flex-col gap-3 rounded-2xl p-4 text-sm leading-relaxed font-semibold',
            flash.kind === 'success' ? 'bg-secondary' : 'bg-destructive/10 text-destructive',
          )}
        >
          <p>{flash.message}</p>
          {flash.kind === 'files_remaining' && (
            <Button
              variant="outline"
              onClick={() => void retryFileRemoval()}
              disabled={retrying}
              className="h-10 self-start rounded-full px-4 font-bold"
            >
              <RotateCw data-icon="inline-start" />
              {retrying ? '正在删除…' : '删除剩余文件'}
            </Button>
          )}
        </div>
      )}

      {data.consent && data.agreedNotice ? (
        <CloudSavingOn
          userId={userId}
          email={email}
          notice={data.agreedNotice}
          latestNotice={data.notice}
          consent={data.consent}
          remainingMs={remainingMs}
          now={now}
          onChanged={onChanged}
        />
      ) : (
        <ConsentStep
          email={email}
          notice={data.notice}
          outdatedConsent={data.consent}
          remainingMs={remainingMs}
          signedInMinutesAgo={signedInMinutesAgo}
          onChanged={onChanged}
        />
      )}
    </div>
  )
}

type ConsentStepProps = {
  email: string
  notice: ConsentNotice
  outdatedConsent: ActiveConsent | null
  remainingMs: number
  signedInMinutesAgo: number | null
  onChanged: (flash: Flash | null) => Promise<void>
}

function ConsentStep({ email, notice, outdatedConsent, remainingMs, signedInMinutesAgo, onChanged }: ConsentStepProps) {
  const [agreed, setAgreed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverSaysStale, setServerSaysStale] = useState(false)
  const fresh = remainingMs > 0 && !serverSaysStale

  const turnOn = async () => {
    setError(null)
    setPending(true)
    try {
      await giveCloudConsent(notice.version)
      void cloudSync.syncNow()
      await onChanged({
        kind: 'success',
        message: '云端保存已开启。这台设备上花园里的图画正在复制到你的账号。',
      })
    } catch (err) {
      if (err instanceof CloudConsentError && err.code === 'recent_sign_in_required') setServerSaysStale(true)
      else setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <section className={PANEL} aria-labelledby="cloud-status-heading">
        <div className="flex items-start gap-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
            aria-hidden="true"
          >
            <CloudOff className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="cloud-status-heading" className="text-xl font-extrabold">
              {outdatedConsent ? '说明已更新' : '云端保存已关闭'}
            </h2>
            <p className="leading-relaxed text-muted-foreground text-pretty">
              {outdatedConsent
                ? `你同意的是第 ${outdatedConsent.noticeVersion} 版说明，它已被替换。请阅读下方第 ${notice.version} 版并同意，在此之前云端保存会暂停。`
                : '孩子涂色的图画只保存在这台设备上。请阅读下方说明后再决定。'}
            </p>
          </div>
        </div>
      </section>

      <ConsentNoticeArticle notice={notice} />

      <section className={PANEL} aria-labelledby="permission-heading">
        <h2 id="permission-heading" className="text-xl font-extrabold">
          你的授权
        </h2>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 has-[:checked]:border-primary">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
          />
          <span className="leading-relaxed">{agreementStatement(notice.version)}</span>
        </label>

        {fresh ? (
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => void turnOn()}
              disabled={!agreed || pending}
              className="h-12 self-start rounded-full px-6 text-base font-bold"
            >
              <Cloud data-icon="inline-start" />
              {pending ? '正在开启…' : '开启云端保存'}
            </Button>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {`你在 ${signedInMinutesAgo ?? 1} 分钟前登录，大约还有 ${minutes(remainingMs)} 分钟可以确认。我们会记录日期、说明版本 ${notice.version} 以及你最近的登录。`}
            </p>
          </div>
        ) : (
          <FreshSignInPrompt email={email} action="开启云端保存" returnPath={RETURN_PATH} />
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

type CloudSavingOnProps = {
  userId: string
  email: string
  notice: ConsentNotice
  latestNotice: ConsentNotice
  consent: ActiveConsent
  remainingMs: number
  now: number
  onChanged: (flash: Flash | null) => Promise<void>
}

function CloudSavingOn({ userId, email, notice, latestNotice, consent, remainingMs, now, onChanged }: CloudSavingOnProps) {
  const newerNotice = latestNotice.version > notice.version ? latestNotice : null
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [needsFreshLink, setNeedsFreshLink] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestTurnOff = () => {
    setError(null)
    if (remainingMs > 0) setConfirmOpen(true)
    else setNeedsFreshLink(true)
  }

  const turnOff = async () => {
    setError(null)
    setPending(true)
    await cloudSync.pause()
    try {
      await disableCloudSaving(userId)
      setConfirmOpen(false)
      await onChanged({
        kind: 'success',
        message: '云端保存已关闭，所有云端副本均已删除。你设备上的图画仍然保留。',
      })
    } catch (err) {
      if (err instanceof CloudConsentError && err.code === 'recent_sign_in_required') {
        setConfirmOpen(false)
        setNeedsFreshLink(true)
      } else if (err instanceof CloudConsentError && err.code === 'files_remaining') {
        setConfirmOpen(false)
        await onChanged({ kind: 'files_remaining', message: err.message })
      } else {
        setError(errorMessage(err))
      }
    } finally {
      setPending(false)
      void cloudSync.resume()
    }
  }

  return (
    <>
      <section className={PANEL} aria-labelledby="cloud-status-heading">
        <div className="flex items-start gap-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <Cloud className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="cloud-status-heading" className="text-xl font-extrabold">
              云端保存已开启
            </h2>
            <p className="leading-relaxed text-muted-foreground text-pretty">
              {`你于 ${formatConsentDate(consent.givenAt)} 同意了第 ${consent.noticeVersion} 版说明。`}
            </p>
          </div>
        </div>
        <CloudSyncStatus now={now} />
        <div className="flex flex-wrap items-start gap-3">
          <ConsentReceiptButton />
          <Button variant="outline" onClick={requestTurnOff} className="h-11 rounded-full px-5 font-bold">
            <CloudOff data-icon="inline-start" />
            关闭云端保存
          </Button>
        </div>
        {needsFreshLink && (
          <FreshSignInPrompt email={email} action="关闭云端保存" returnPath={RETURN_PATH} />
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
      </section>

      {newerNotice && (
        <section className={PANEL} aria-labelledby="notice-updated-heading">
          <div className="flex flex-col gap-2">
            <h2 id="notice-updated-heading" className="text-xl font-extrabold">
              {`我们已将说明更新到第 ${newerNotice.version} 版`}
            </h2>
            <p className="leading-relaxed text-muted-foreground text-pretty">
              {`${NOTICE_CHANGES[newerNotice.version] ?? '措辞有所调整。'}你在第 ${notice.version} 版下的授权依然有效，无需任何操作。`}
            </p>
          </div>
          <details className="rounded-2xl bg-secondary p-5">
            <summary className="cursor-pointer font-bold">{`阅读第 ${newerNotice.version} 版`}</summary>
            <div className="mt-5">
              <NoticeSections body={newerNotice.body} />
            </div>
          </details>
        </section>
      )}

      <details className="group rounded-3xl border bg-card p-6 md:p-8">
        <summary className="cursor-pointer font-extrabold">
          {`阅读你同意的说明（第 ${notice.version} 版）`}
        </summary>
        <div className="mt-6">
          <NoticeSections body={notice.body} />
        </div>
      </details>

      <Dialog open={confirmOpen} onOpenChange={(open) => !pending && setConfirmOpen(open)}>
        <DialogContent className="gap-5 rounded-3xl p-6 sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black">要关闭云端保存吗？</DialogTitle>
            <DialogDescription className="leading-relaxed">
              {'这会撤回你的授权，并删除孩子图画的所有云端副本。已在你设备上的图画会保留。之后你可以再次开启。'}
            </DialogDescription>
          </DialogHeader>
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
              保持开启
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => void turnOff()}
              disabled={pending}
              className="h-11 rounded-full px-5 font-bold"
            >
              {pending ? '正在关闭…' : '关闭并删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
