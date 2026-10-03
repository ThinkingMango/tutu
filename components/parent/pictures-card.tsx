'use client'

import Link from 'next/link'
import { Printer } from 'lucide-react'
import { ParentCard } from '@/components/parent/parent-card'
import { buttonVariants } from '@/components/ui/button'
import { pictureCount } from '@/hooks/use-garden'
import { useArtworkLibrary } from '@/hooks/use-artwork-library'
import { useHydrated } from '@/lib/local-store'
import { cn } from '@/lib/utils'

export function PicturesCard() {
  const hydrated = useHydrated()
  const { state } = useArtworkLibrary()
  const count = state.gallery.length
  const description = !hydrated
    ? '正在检查这台设备…'
    : count === 0
      ? '还没有完成的图画。完成后可以打印或保存为 PDF。'
      : `这台设备上有 ${pictureCount(count)}。可以打印或保存为 PDF，并查看哪些已保存到你的账号。`

  return (
    <ParentCard title="Pictures" description={description}>
      <Link
        href="/parent/pictures"
        className={cn(buttonVariants({ variant: 'outline' }), 'h-11 self-start rounded-full px-5 font-bold')}
      >
        <Printer data-icon="inline-start" />
        打印或保存为 PDF
      </Link>
    </ParentCard>
  )
}
