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

const plural = (n: number) => `${n} 张图画`

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
        退出登录
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

  const signOut = async () => {
    setError(null)
    setPending(true)
    try {
      await signOutOfDevice(offerChoice ? choice : 'keep')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '退出登录未完成，请再试一次。')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="gap-5 rounded-3xl p-6 sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black">要在这台设备上退出登录吗？</DialogTitle>
          <DialogDescription className="leading-relaxed">
            {'这台设备将停止与你的账号同步。请选择如何处理你的图画。'}
          </DialogDescription>
        </DialogHeader>

        <div aria-live="polite" className="flex flex-col gap-4">
          {checking ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              正在检查哪些图画已保存到你的账号…
            </p>
          ) : summary.state === 'off' ? (
            <p className="text-sm leading-relaxed">
              {'云端保存已关闭，这台设备上没有存储你账号的内容。孩子的图画会保留在这里。'}
            </p>
          ) : !cloudOn ? (
            <p className="text-sm leading-relaxed">
              {'暂时无法连接你的账号，所以所有图画都会保留在这台设备上。你可以现在退出，或取消后在联网时再试。'}
            </p>
          ) : offerChoice ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 text-sm font-bold">
                {`这台设备上有 ${plural(summary.saved)}已保存到你的账号`}
              </legend>
              <ChoiceOption
                value="remove"
                checked={choice === 'remove'}
                onSelect={setChoice}
                title="从这台设备上移除"
                detail="适合共用设备或学校设备。图画会安全地保存在你的账号里，再次登录时就会回来。未完成的图画会保留。"
              />
              <ChoiceOption
                value="keep"
                checked={choice === 'keep'}
                onSelect={setChoice}
                title="保留在这台设备上"
                detail="图画会留在这台设备的花园里，任何使用者都能看到。如果其他家长在这里登录并开启了云端保存，图画会保存到那个账号。"
              />
            </fieldset>
          ) : summary.waiting === 0 ? (
            <p className="text-sm leading-relaxed">这台设备上没有花园图画。</p>
          ) : null}

          {cloudOn && summary.waiting > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl bg-warning p-4 text-sm leading-relaxed text-warning-foreground">
              <p className="font-semibold">
                {`还有 ${plural(summary.waiting)}尚未保存到你的账号，所以无论如何它们都会保留在这台设备上。`}
                {summary.state === 'offline' && '这台设备已离线。'}
              </p>
              <Button
                variant="outline"
                onClick={() => void cloudSync.syncNow()}
                disabled={summary.state === 'syncing' || pending}
                className="h-10 self-start rounded-full bg-card px-4 font-bold text-foreground"
              >
                <RotateCw data-icon="inline-start" />
                {summary.state === 'syncing' ? '正在保存…' : '立即尝试保存'}
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
            保持登录
          </DialogClose>
          <Button onClick={() => void signOut()} disabled={pending || checking} className="h-11 rounded-full px-5 font-bold">
            <LogOut data-icon="inline-start" />
            {pending ? '正在退出…' : '退出登录'}
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
