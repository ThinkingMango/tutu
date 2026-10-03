'use client'

import { useState } from 'react'
import { CircleAlert, CircleCheck, LoaderCircle, RotateCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cloudSync, useCloudSync } from '@/lib/cloud-sync/client'
import type { SyncSummary } from '@/lib/cloud-sync/engine'
import { cn } from '@/lib/utils'

function pictures(count: number) {
  return `${count} 张花园图画`
}

function describe(summary: SyncSummary): { title: string; detail: string } {
  const { state, total, saved, waiting } = summary
  switch (state) {
    case 'syncing':
      return {
        title: `正在保存第 ${saved} / ${total} 张…`,
        detail: '正在把这台设备上的花园图画复制到你的账号。',
      }
    case 'synced':
      return total === 0
        ? {
            title: '暂时没有需要保存的图画',
            detail: '孩子放进“我的花园”的图画会被复制到你的账号。',
          }
        : {
            title: total === 1 ? '你的花园图画已保存' : `全部 ${total} 张花园图画已保存`,
            detail: '这台设备上“我的花园”里的每张图画都已保存到你的账号。',
          }
    case 'waiting':
      return {
        title: `${pictures(waiting)}尚未保存`,
        detail: `已有 ${saved} / ${total} 张保存到你的账号。我们会自动继续尝试。不会丢失任何图画，其余的仍在这台设备上。`,
      }
    case 'offline':
      return {
        title: '这台设备已离线',
        detail:
          waiting > 0
            ? `${pictures(waiting)}会在恢复联网后保存，它们在这台设备上很安全。`
            : '恢复联网后我们会检查更新。',
      }
    case 'unavailable':
      return {
        title: '暂时无法连接到你的云端图画',
        detail: '不会丢失任何图画。图画仍在这台设备上，我们稍后会再试。',
      }
    default:
      return { title: '正在检查你的云端图画…', detail: '只需要一小会儿。' }
  }
}

function checkedLabel(checkedAt: number | null, now: number) {
  if (!checkedAt) return null
  const minutes = Math.floor((now - checkedAt) / 60_000)
  if (minutes < 1) return '刚刚检查过'
  if (minutes < 60) return `${minutes} 分钟前检查过`
  return `检查于 ${new Date(checkedAt).toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit' })}`
}

const ICONS = {
  synced: CircleCheck,
  syncing: LoaderCircle,
  checking: LoaderCircle,
  offline: WifiOff,
} as const

export function CloudSyncStatus({ now }: { now: number }) {
  const { snapshot, summary } = useCloudSync()
  const [requested, setRequested] = useState(false)
  const { title, detail } = describe(summary)
  const busy = snapshot.running || requested
  const Icon = ICONS[summary.state as keyof typeof ICONS] ?? CircleAlert
  const spinning = summary.state === 'syncing' || summary.state === 'checking'
  const good = summary.state === 'synced'
  const percent = summary.total > 0 ? Math.round((summary.saved / summary.total) * 100) : 100

  const syncNow = async () => {
    setRequested(true)
    try {
      await cloudSync.syncNow()
    } finally {
      setRequested(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-secondary p-4 md:p-5">
      <div role="status" aria-live="polite" className="flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className={cn(
            'mt-0.5 size-5 shrink-0',
            good ? 'text-primary' : 'text-muted-foreground',
            (summary.state === 'waiting' || summary.state === 'unavailable') && 'text-destructive',
            spinning && 'animate-spin motion-reduce:animate-none',
          )}
        />
        <div className="flex flex-col gap-1">
          <p className="font-extrabold">{title}</p>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{detail}</p>
        </div>
      </div>

      {summary.total > 0 && summary.state !== 'checking' && (
        <div
          role="progressbar"
          aria-label="已保存到你账号的花园图画"
          aria-valuemin={0}
          aria-valuemax={summary.total}
          aria-valuenow={summary.saved}
          aria-valuetext={`已保存 ${summary.saved} / ${summary.total} 张`}
          className="h-2 overflow-hidden rounded-full bg-background"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {summary.removedElsewhere > 0 && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {summary.removedElsewhere === 1
            ? '这台设备上有 1 张图画已在另一台设备上从花园移出，因此不会保存到你的账号，但仍会保留在这台设备上。'
            : `这台设备上有 ${summary.removedElsewhere} 张图画已在另一台设备上从花园移出，因此不会保存到你的账号，但仍会保留在这台设备上。`}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{checkedLabel(summary.checkedAt, now) ?? ''}</p>
        <Button
          variant="outline"
          onClick={() => void syncNow()}
          disabled={busy}
          className="h-10 rounded-full bg-card px-4 font-bold"
        >
          <RotateCw data-icon="inline-start" className={cn(busy && 'animate-spin motion-reduce:animate-none')} />
          {busy ? '正在同步…' : '立即同步'}
        </Button>
      </div>
    </div>
  )
}
