'use client'

import { useLayoutEffect, useState } from 'react'
import { useDraftView } from '@/hooks/use-artwork-library'
import type { Mandala } from '@/lib/mandalas'
import type { ColorKey } from '@/lib/palette'

/**
 * Coloring actions for one visit to a page. Each visit starts white, or with the colors of the
 * garden picture it was opened from. Unsaved coloring is dropped when the child leaves. Saving
 * adds a new garden picture, or updates the one this visit is editing.
 */
export function useColoring(mandala: Mandala, gardenArtworkId: string | null = null) {
  const { library, state, draft, version, fills, history } = useDraftView(mandala)
  const templateId = mandala.id
  const [savedId, setSavedId] = useState(gardenArtworkId)
  const editingId =
    savedId && state.gallery.some((artwork) => artwork.id === savedId && artwork.templateId === templateId)
      ? savedId
      : null

  useLayoutEffect(() => {
    library.startSession(templateId, gardenArtworkId)
    return () => {
      library.finishDraft(templateId)
    }
  }, [library, templateId, gardenArtworkId])

  return {
    draft,
    version,
    fills,
    editingGardenPicture: editingId !== null,
    fill: (regionId: string, color: ColorKey) => library.fillRegion(templateId, regionId, color) !== null,
    erase: (regionId: string) => library.eraseRegion(templateId, regionId) !== null,
    clear: () => library.clearDraft(templateId) !== null,
    undo: () => library.undo(templateId),
    redo: () => library.redo(templateId),
    save: () => {
      const id = library.saveSession(templateId, editingId)
      if (id) setSavedId(id)
      return id !== null
    },
    finish: () => library.finishDraft(templateId),
    canUndo: history.undo.length > 0,
    canRedo: history.redo.length > 0,
    hasColor: Object.keys(fills).length > 0,
  }
}
