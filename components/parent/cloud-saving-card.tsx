'use client'

import Link from 'next/link'
import { ParentCard } from '@/components/parent/parent-card'
import { buttonVariants } from '@/components/ui/button'
import { useAuthState } from '@/lib/auth/client'
import { isCloudSavingOn, useCloudConsent } from '@/lib/cloud-consent/client'
import { useCloudSync } from '@/lib/cloud-sync/client'
import { cn } from '@/lib/utils'

export function CloudSavingCard() {
  const auth = useAuthState()
  const { data, error } = useCloudConsent(auth.user?.id ?? null)

  const { summary } = useCloudSync()
  const isOn = isCloudSavingOn(data)
  const syncLine =
    summary.state === 'synced'
      ? summary.total === 0
        ? '花园图画添加后会自动备份。'
        : summary.total === 1
          ? '你的花园图画已保存。'
          : `全部 ${summary.total} 张花园图画已保存。`
      : summary.state === 'syncing'
        ? `Saving ${summary.saved} of ${summary.total}…`
        : summary.state === 'waiting' || summary.state === 'offline'
          ? `${summary.total} 张中有 ${summary.waiting} 张尚未保存。`
          : summary.state === 'unavailable'
            ? '暂时无法查看云端状态。'
            : null
  const description =
    auth.status === 'loading' || (auth.status === 'signed-in' && !data && !error)
      ? '正在检查…'
      : auth.status === 'signed-out'
        ? '可选的花园图画备份。登录后即可设置。'
        : error
          ? '暂时无法查看云端保存状态。'
          : isOn
            ? `已开启。${syncLine ?? '正在检查你的云端图画…'}`
            : '已关闭。图画仅保存在这台设备上。'

  return (
    <ParentCard
      title="云端保存"
      description={description}
      badge={
        auth.status === 'signed-in' && data ? (
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold',
              isOn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
            )}
          >
            {isOn ? 'On' : 'Off'}
          </span>
        ) : null
      }
    >
      <Link
        href="/parent/cloud-saving"
        className={cn(buttonVariants({ variant: 'outline' }), 'h-11 self-start rounded-full px-5 font-bold')}
      >
        {isOn ? '管理云端保存' : '了解云端保存'}
      </Link>
    </ParentCard>
  )
}
