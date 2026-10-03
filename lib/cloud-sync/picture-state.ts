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
  'device-only': { short: '仅在此设备', detail: '仅保存在这台设备上，没有云端副本。' },
  'in-cloud': { short: '账户中也有', detail: '保存在这台设备上，你的账户中也有一份副本。' },
  waiting: { short: '尚未存入账户', detail: '保存在这台设备上，云端副本尚未生成。' },
  'removed-elsewhere': {
    short: '仅在此设备',
    detail: '保存在这台设备上。它已在另一台设备上从花园中移除，因此不会复制到你的账户。',
  },
  checking: { short: '检查中…', detail: '保存在这台设备上，正在检查你的账户中是否有副本。' },
}
