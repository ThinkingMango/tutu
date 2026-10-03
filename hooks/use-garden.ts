'use client'

import { useArtworkLibrary } from '@/hooks/use-artwork-library'
import { getMandala } from '@/lib/mandalas'
import { isGrownUpPage } from '@/lib/packs'

/** The children's finished pictures, newest first. Grown-up pages live in their own space. */
export function useGarden() {
  const { library, state } = useArtworkLibrary()
  const artworks = state.gallery.filter((artwork) => {
    const mandala = getMandala(artwork.templateId)
    return !mandala || !isGrownUpPage(mandala)
  })
  return { library, artworks }
}

export function pictureCount(count: number) {
  return `${count} 张图画`
}
