'use client'

import { useState } from 'react'
import { CircleAlert, CircleCheck, LoaderCircle, RotateCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cloudSync, useCloudSync } from '@/lib/cloud-sync/client'
import type { SyncSummary } from '@/lib/cloud-sync/engine'
import { cn } from '@/lib/utils'

function pictures(count: number) {
  return count === 1 ? '1 garden picture' : `${count} garden pictures`
}

function describe(summary: SyncSummary): { title: string; detail: string } {
  const { state, total, saved, waiting } = summary
  switch (state) {
    case 'syncing':
      return {
        title: `Saving ${saved} of ${total}…`,
        detail: 'Copying garden pictures from this device to your account.',
      }
    case 'synced':
      return total === 0
        ? {
            title: 'Nothing to save yet',
            detail: 'Pictures your child puts in My garden will be copied to your account.',
          }
        : {
            title: total === 1 ? 'Your garden picture is saved' : `All ${total} garden pictures are saved`,
            detail: 'Every picture in My garden on this device is in your account.',
          }
    case 'waiting':
      return {
        title: `${pictures(waiting)} not saved yet`,
        detail: `${saved} of ${total} are in your account. We’ll keep trying on our own. Nothing is lost, the rest are still on this device.`,
      }
    case 'offline':
      return {
        title: 'This device is offline',
        detail:
          waiting > 0
            ? `${pictures(waiting)} will be saved when you’re back online. They’re safe on this device.`
            : 'We’ll check for changes when you’re back online.',
      }
    case 'unavailable':
      return {
        title: 'We couldn’t reach your cloud pictures',
        detail: 'Nothing is lost. Pictures stay on this device and we’ll try again shortly.',
      }
    default:
      return { title: 'Checking your cloud pictures…', detail: 'This only takes a moment.' }
  }
}

function checkedLabel(checkedAt: number | null, now: number) {
  if (!checkedAt) return null
  const minutes = Math.floor((now - checkedAt) / 60_000)
  if (minutes < 1) return 'Checked just now'
  if (minutes < 60) return `Checked ${minutes} min ago`
  return `Checked at ${new Date(checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
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
          aria-label="Garden pictures saved to your account"
          aria-valuemin={0}
          aria-valuemax={summary.total}
          aria-valuenow={summary.saved}
          aria-valuetext={`${summary.saved} of ${summary.total} saved`}
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
            ? '1 picture on this device was taken out of the garden on another device, so it isn’t saved to your account. It stays on this device.'
            : `${summary.removedElsewhere} pictures on this device were taken out of the garden on another device, so they aren’t saved to your account. They stay on this device.`}
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
          {busy ? 'Syncing…' : 'Sync now'}
        </Button>
      </div>
    </div>
  )
}
