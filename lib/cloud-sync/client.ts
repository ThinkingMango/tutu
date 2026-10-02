import { useSyncExternalStore } from 'react'
import { useArtworkLibrary } from '@/hooks/use-artwork-library'
import { artworkLibrary } from '@/lib/artwork/default-library'
import { createCloudSync, summarizeSync } from '@/lib/cloud-sync/engine'
import { createClient } from '@/lib/supabase/client'

export const cloudSync = createCloudSync({ library: artworkLibrary, client: createClient })

export function useCloudSync() {
  const snapshot = useSyncExternalStore(cloudSync.subscribe, cloudSync.getSnapshot, cloudSync.getServerSnapshot)
  const { state } = useArtworkLibrary()
  return { snapshot, summary: summarizeSync(snapshot, state.gallery) }
}
