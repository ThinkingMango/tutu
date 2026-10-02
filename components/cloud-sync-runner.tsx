'use client'

import { useEffect } from 'react'
import { useAuthState } from '@/lib/auth/client'
import { cloudSync } from '@/lib/cloud-sync/client'

/** Keeps garden pictures in sync in the background. Does nothing for guests or without consent. */
export function CloudSyncRunner() {
  const auth = useAuthState()
  const parentId = auth.status === 'loading' ? undefined : (auth.user?.id ?? null)

  useEffect(() => cloudSync.start(), [])

  useEffect(() => {
    if (parentId !== undefined) cloudSync.setParent(parentId)
  }, [parentId])

  return null
}
