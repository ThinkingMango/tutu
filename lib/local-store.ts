import { useSyncExternalStore } from 'react'

type Listener = () => void

export type LocalStore<T> = {
  read: () => T
  write: (value: T) => void
  clear: () => void
  subscribe: (listener: Listener) => () => void
  getServerSnapshot: () => T
}

/**
 * A tiny on-device store with a stable snapshot, suitable for useSyncExternalStore.
 * Used for mock billing, device settings and kids' artwork on this device.
 */
export function createLocalStore<T>(
  key: string,
  fallback: T,
  area: 'local' | 'session' = 'local',
): LocalStore<T> {
  const listeners = new Set<Listener>()
  let lastRaw: string | null | undefined
  let cached: T = fallback

  const storage = () => {
    if (typeof window === 'undefined') return null
    try {
      return area === 'local' ? window.localStorage : window.sessionStorage
    } catch {
      return null
    }
  }

  const notify = () => listeners.forEach((l) => l())

  return {
    read() {
      const s = storage()
      if (!s) return fallback
      const raw = s.getItem(key)
      if (raw === lastRaw) return cached
      lastRaw = raw
      try {
        cached = raw === null ? fallback : (JSON.parse(raw) as T)
      } catch {
        cached = fallback
      }
      return cached
    },
    write(value) {
      storage()?.setItem(key, JSON.stringify(value))
      notify()
    },
    clear() {
      storage()?.removeItem(key)
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      const onStorage = (e: StorageEvent) => {
        if (e.key === key || e.key === null) listener()
      }
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', onStorage)
      }
    },
    getServerSnapshot: () => fallback,
  }
}

export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.read, store.getServerSnapshot)
}

const noopSubscribe = () => () => {}

/** True only after hydration, so on-device state never causes a mismatch or flash. */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}
