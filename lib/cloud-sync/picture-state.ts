import type { SyncSnapshot } from '@/lib/cloud-sync/engine'

/**
 * Where one garden picture is kept. Every picture in the list is on this device; this says whether the
 * parent's account has a copy too, going only by what the database confirmed.
 */
export type PictureSaveState = 'device-only' | 'in-cloud' | 'waiting' | 'removed-elsewhere' | 'checking'

export function pictureSaveState(snapshot: SyncSnapshot, artworkId: string): PictureSaveState {
  if (!snapshot.parentId || snapshot.enabled === false) return 'device-only'
  if (snapshot.enabled === null) return 'checking'
  if (snapshot.blockedIds.has(artworkId)) return 'removed-elsewhere'
  if (snapshot.cloudIds.has(artworkId)) return 'in-cloud'
  return 'waiting'
}

export const SAVE_STATE_LABEL: Record<PictureSaveState, { short: string; detail: string }> = {
  'device-only': { short: 'This device only', detail: 'Only on this device. There is no cloud copy.' },
  'in-cloud': { short: 'Also in your account', detail: 'On this device, with a copy in your account.' },
  waiting: { short: 'Not in your account yet', detail: 'On this device. The cloud copy has not been made yet.' },
  'removed-elsewhere': {
    short: 'This device only',
    detail: 'On this device. It was taken out of the garden on another device, so it is not copied to your account.',
  },
  checking: { short: 'Checking…', detail: 'On this device. Checking your account for a copy.' },
}
