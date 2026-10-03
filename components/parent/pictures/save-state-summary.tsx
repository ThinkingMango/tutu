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
        value: '未登录',
        detail: '不会复制到任何地方。登录并开启云端保存即可备份。',
        link: '了解云端保存',
      }
    case 'off':
      return {
        value: '云端保存已关闭',
        detail: '不会复制到你的账号，图画只保存在这台设备上。',
        link: '了解云端保存',
      }
    case 'checking':
      return { value: '正在检查…', detail: '正在查找你账号里的副本。', link: '管理云端保存' }
    case 'unavailable':
    case 'offline':
      return {
        value: `已复制 ${summary.saved} / ${summary.total} 张`,
        detail: '暂时无法检查你的账号。这台设备上的图画很安全。',
        link: '管理云端保存',
      }
    default:
      return {
        value: `已复制 ${summary.saved} / ${pictureCount(summary.total)}`,
        detail:
          summary.waiting === 0
            ? '这里的每张图画在你的账号里都有副本。关闭云端保存会删除这些副本。'
            : `还有 ${summary.waiting} 张待复制，在此之前它们在这台设备上很安全。`,
        link: '管理云端保存',
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
        图画保存在哪里
      </h2>
      <div className="flex flex-col gap-3 md:flex-row">
        <Place
          icon={<MonitorSmartphone className="size-5" />}
          label="在这台设备上"
          value={pictureCount(onDevice)}
          detail="打印和 PDF 也都在这里生成，不会上传任何内容。"
        />
        <Place
          icon={<Cloud className="size-5" />}
          label="在你的账号里"
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
