import type { Metadata } from 'next'
import { CloudSavingView } from '@/components/parent/cloud-saving-view'

export const metadata: Metadata = { title: 'Cloud saving' }

export default function CloudSavingPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 md:px-8 md:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black">Cloud saving</h1>
        <p className="leading-relaxed text-muted-foreground text-pretty">
          Optional. Back up garden pictures to your parent account. Little Mandala works fully without it.
        </p>
      </div>
      <CloudSavingView />
    </main>
  )
}
