import { createArtworkLibrary } from '@/lib/artwork/library'
import { MANDALAS, templates } from '@/lib/mandalas'

export const artworkLibrary = createArtworkLibrary({
  storage: () => (typeof window === 'undefined' ? null : window.localStorage),
  templates,
  legacy: { templateIds: MANDALAS.map((m) => m.id), key: (id) => `lm:art:${id}` },
})
