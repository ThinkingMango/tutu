import type { Metadata } from 'next'
import { PicturesView } from '@/components/parent/pictures/pictures-view'

export const metadata: Metadata = { title: '图画' }

export default function ParentPicturesPage() {
  return <PicturesView />
}
