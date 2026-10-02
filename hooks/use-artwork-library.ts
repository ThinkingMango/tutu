'use client'

import { createContext, useContext, useSyncExternalStore } from 'react'
import { artworkLibrary } from '@/lib/artwork/default-library'
import {
  EMPTY_FILLS,
  EMPTY_STATE,
  selectDraft,
  selectHistory,
  type ArtworkLibrary,
} from '@/lib/artwork/library'
import { latestVersion, type Mandala } from '@/lib/mandalas'

const ArtworkLibraryContext = createContext<ArtworkLibrary>(artworkLibrary)

/** Only needed to inject a different library (tests); the app uses the on-device default. */
export const ArtworkLibraryProvider = ArtworkLibraryContext.Provider

const getServerState = () => EMPTY_STATE

export function useArtworkLibrary() {
  const library = useContext(ArtworkLibraryContext)
  const state = useSyncExternalStore(library.subscribe, library.getState, getServerState)
  return { library, state }
}

/** The flower's current draft, rendered with the exact template version it was started on. */
export function useDraftView(mandala: Mandala) {
  const { library, state } = useArtworkLibrary()
  const draft = selectDraft(state, mandala.id)
  const version =
    (draft && library.templates.version(draft.templateId, draft.templateVersion)) || latestVersion(mandala)
  return {
    library,
    state,
    draft,
    version,
    fills: draft?.fills ?? EMPTY_FILLS,
    history: selectHistory(state, mandala.id),
  }
}
