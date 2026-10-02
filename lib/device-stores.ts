import { createLocalStore } from '@/lib/local-store'

export type DeviceSettings = { motion: boolean; haptics: boolean }

export const settingsStore = createLocalStore<DeviceSettings>('lm:settings', {
  motion: true,
  haptics: true,
})

export const parentGateStore = createLocalStore<boolean>('lm:gate', false, 'session')
