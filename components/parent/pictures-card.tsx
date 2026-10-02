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
    ? 'Checking this device…'
    : count === 0
      ? 'No finished pictures yet. When there are, you can print them or save a PDF.'
      : `${pictureCount(count)} on this device. Print them or save a PDF, and see which are in your account.`

  return (
    <ParentCard title="Pictures" description={description}>
      <Link
        href="/parent/pictures"
        className={cn(buttonVariants({ variant: 'outline' }), 'h-11 self-start rounded-full px-5 font-bold')}
      >
        <Printer data-icon="inline-start" />
        Print or save as PDF
      </Link>
    </ParentCard>
  )
}
