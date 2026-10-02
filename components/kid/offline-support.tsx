'use client'

import { useEffect } from 'react'

const KEPT_KEY = 'lm:offline-kept'
/** Even without an update, refresh the kept copies now and then. */
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000

type Kept = { deployment: string; at: number }

/** Each deployment's pages and build files differ, so a new deployment means keeping them again. */
function currentDeployment() {
  return document.documentElement.dataset.dplId ?? 'local'
}

function readKept(): Kept | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEPT_KEY) ?? 'null') as Partial<Kept> | null
    return value && typeof value.deployment === 'string' && typeof value.at === 'number' ? (value as Kept) : null
  } catch {
    return null
  }
}

function shouldKeep(now: number) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (!navigator.onLine || connection?.saveData) return false
  const kept = readKept()
  return !kept || kept.deployment !== currentDeployment() || now - kept.at > REFRESH_MS
}

/**
 * Turns on the offline helper (public/sw.js) and, once per update, asks it to keep every children's
 * screen, so coloring keeps working in the car or on a plane. About 2 MB, fetched after the page has
 * loaded so it never slows the first screen. Only on the live app: in development it would serve
 * stale copies of code being edited.
 */
export function OfflineSupport({ pages }: { pages: readonly string[] }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    let cancelled = false

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'kept-for-offline' && event.data.failed === 0) {
        try {
          localStorage.setItem(KEPT_KEY, JSON.stringify({ deployment: currentDeployment(), at: Date.now() }))
        } catch {}
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)

    const start = async () => {
      await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      const { active } = await navigator.serviceWorker.ready
      if (!cancelled && active && shouldKeep(Date.now())) active.postMessage({ type: 'keep-for-offline', pages })
    }
    const begin = () => {
      start().catch((error: unknown) => {
        console.error('Setting up offline coloring failed', error instanceof Error ? error.message : error)
      })
    }
    if (document.readyState === 'complete') begin()
    else window.addEventListener('load', begin, { once: true })

    return () => {
      cancelled = true
      window.removeEventListener('load', begin)
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [pages])
  return null
}
