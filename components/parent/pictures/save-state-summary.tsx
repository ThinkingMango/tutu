'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Cloud, MonitorSmartphone } from 'lucide-react'
import { pictureCount } from '@/hooks/use-garden'
import { useCloudSync } from '@/lib/cloud-sync/client'
import type { SyncSummary } from '@/lib/cloud-sync/engine'

const LINK = 'self-start text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none'

function accountLine(summary: SyncSummary): { value: string; detail: string; link: string } {
  switch (summary.state) {
    case 'signed-out':
      return {
        value: 'Not signed in',
        detail: 'Nothing is copied anywhere. Sign in and turn on cloud saving to keep a backup.',
        link: 'Read about cloud saving',
      }
    case 'off':
      return {
        value: 'Cloud saving is off',
        detail: 'Nothing is copied to your account. Pictures live on this device only.',
        link: 'Read about cloud saving',
      }
    case 'checking':
      return { value: 'Checking…', detail: 'Looking for copies in your account.', link: 'Manage cloud saving' }
    case 'unavailable':
    case 'offline':
      return {
        value: `${summary.saved} of ${summary.total} copied`,
        detail: 'We couldn’t check your account just now. Pictures on this device are safe.',
        link: 'Manage cloud saving',
      }
    default:
      return {
        value: `${summary.saved} of ${pictureCount(summary.total)} copied`,
        detail:
          summary.waiting === 0
            ? 'Every picture here also has a copy in your account. Turning cloud saving off deletes those copies.'
            : `${summary.waiting} still to copy. They’re safe on this device until then.`,
        link: 'Manage cloud saving',
      }
  }
}

function Place({
  icon,
  label,
  value,
  detail,
  action,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-1 items-start gap-4 rounded-3xl border bg-card p-5">
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</h3>
        <p className="text-lg font-extrabold">{value}</p>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{detail}</p>
        {action}
      </div>
    </div>
  )
}

/** Where the garden is kept right now: always this device, and a copy in the account only when the database confirms it. */
export function SaveStateSummary({ onDevice }: { onDevice: number }) {
  const { summary } = useCloudSync()
  const account = accountLine(summary)

  return (
    <section aria-labelledby="where-heading" className="flex flex-col gap-3">
      <h2 id="where-heading" className="sr-only">
        Where pictures are kept
      </h2>
      <div className="flex flex-col gap-3 md:flex-row">
        <Place
          icon={<MonitorSmartphone className="size-5" />}
          label="On this device"
          value={pictureCount(onDevice)}
          detail="Printing and PDFs are made here too, nothing is uploaded."
        />
        <Place
          icon={<Cloud className="size-5" />}
          label="In your account"
          value={account.value}
          detail={account.detail}
          action={
            <Link href="/parent/cloud-saving" className={LINK}>
              {account.link}
            </Link>
          }
        />
      </div>
    </section>
  )
}
