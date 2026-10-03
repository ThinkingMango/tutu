import type { Metadata } from 'next'
import { AccountCard } from '@/components/parent/account-card'
import { CloudSavingCard } from '@/components/parent/cloud-saving-card'
import { DeviceSettingsCard } from '@/components/parent/device-settings-card'
import { PicturesCard } from '@/components/parent/pictures-card'
import { PlanSummaryCard } from '@/components/parent/plan-summary-card'

export const metadata: Metadata = { title: '家长概览' }

export default function ParentHomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-8 md:py-10">
      <h1 className="text-3xl font-black">Overview</h1>
      <PlanSummaryCard />
      <PicturesCard />
      <AccountCard />
      <CloudSavingCard />
      <DeviceSettingsCard />
    </main>
  )
}
