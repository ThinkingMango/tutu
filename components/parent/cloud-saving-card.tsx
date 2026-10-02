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
        ? 'Garden pictures will be copied as they’re added.'
        : summary.total === 1
          ? 'Your garden picture is saved.'
          : `All ${summary.total} garden pictures saved.`
      : summary.state === 'syncing'
        ? `Saving ${summary.saved} of ${summary.total}…`
        : summary.state === 'waiting' || summary.state === 'offline'
          ? `${summary.waiting} of ${summary.total} not saved yet.`
          : summary.state === 'unavailable'
            ? 'Couldn’t check the cloud right now.'
            : null
  const description =
    auth.status === 'loading' || (auth.status === 'signed-in' && !data && !error)
      ? 'Checking…'
      : auth.status === 'signed-out'
        ? 'Optional backup of garden pictures. Sign in to set it up.'
        : error
          ? 'We couldn’t check cloud saving right now.'
          : isOn
            ? `On. ${syncLine ?? 'Checking your cloud pictures…'}`
            : 'Off. Pictures stay on this device only.'

  return (
    <ParentCard
      title="Cloud saving"
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
        {isOn ? 'Manage cloud saving' : 'Read about cloud saving'}
      </Link>
    </ParentCard>
  )
}
