import { describe, expect, it } from 'vitest'
import type { SyncSnapshot } from '@/lib/cloud-sync/engine'
import { pictureSaveState } from '@/lib/cloud-sync/picture-state'

const base: SyncSnapshot = {
  parentId: 'parent-1',
  enabled: true,
  running: false,
  checkedAt: 1,
  cloudIds: new Set(['saved']),
  blockedIds: new Set(['blocked']),
  failedIds: new Set(),
  problem: null,
}

describe('pictureSaveState', () => {
  it('is device-only for guests and when cloud saving is off', () => {
    expect(pictureSaveState({ ...base, parentId: null }, 'saved')).toBe('device-only')
    expect(pictureSaveState({ ...base, enabled: false }, 'saved')).toBe('device-only')
  })

  it('waits for the first check before claiming anything', () => {
    expect(pictureSaveState({ ...base, enabled: null }, 'saved')).toBe('checking')
  })

  it('only says "in your account" when the database confirmed it', () => {
    expect(pictureSaveState(base, 'saved')).toBe('in-cloud')
    expect(pictureSaveState(base, 'new')).toBe('waiting')
    expect(pictureSaveState({ ...base, problem: 'offline' }, 'new')).toBe('waiting')
  })

  it('marks pictures taken out on another device', () => {
    expect(pictureSaveState(base, 'blocked')).toBe('removed-elsewhere')
  })
})
