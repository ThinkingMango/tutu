import type { Metadata } from 'next'
import { CloudSavingView } from '@/components/parent/cloud-saving-view'

export const metadata: Metadata = { title: '云端保存' }

export default function CloudSavingPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 md:px-8 md:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black">Cloud saving</h1>
        <p className="leading-relaxed text-muted-foreground text-pretty">
          可选功能。将花园图画备份到你的家长账号。不开启也能完整使用小小曼陀罗。
        </p>
      </div>
      <CloudSavingView />
    </main>
  )
}
