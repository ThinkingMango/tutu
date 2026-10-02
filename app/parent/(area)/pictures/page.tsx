import type { Metadata } from 'next'
import { PicturesView } from '@/components/parent/pictures/pictures-view'

export const metadata: Metadata = { title: 'Pictures' }

export default function ParentPicturesPage() {
  return <PicturesView />
}
