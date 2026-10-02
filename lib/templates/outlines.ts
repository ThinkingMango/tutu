import type { Outline, TemplateVersion } from '@/lib/mandalas'

/**
 * Where each page's outline comes from. Code-drawn pages (Standard, earlier drawings) are small and
 * ship with the app. Traced pages are most of the app's size, so each one is fetched the first time
 * it is drawn and then kept for the rest of the visit: opening one page never downloads the others.
 *
 * Pages themselves stay plain data (they cross from server to browser), so loaders live here, keyed
 * by page and version.
 */

type VersionRef = Pick<TemplateVersion, 'templateId' | 'version'>

const inline = new Map<string, Outline>()
const loaders = new Map<string, () => Promise<Outline>>()
const loaded = new Map<string, Outline>()
const pending = new Map<string, Promise<Outline>>()
const listeners = new Set<() => void>()

const keyOf = ({ templateId, version }: VersionRef) => `${templateId}@${version}`

export function registerInlineOutline(ref: VersionRef, outline: Outline) {
  inline.set(keyOf(ref), outline)
}

export function registerOutlineLoader(ref: VersionRef, load: () => Promise<Outline>) {
  loaders.set(keyOf(ref), load)
}

/** The outline if it's already here, without fetching anything. */
export function peekOutline(ref: VersionRef): Outline | null {
  const key = keyOf(ref)
  return inline.get(key) ?? loaded.get(key) ?? null
}

/** The outline, fetching it once if needed. Concurrent callers share one request. */
export function loadOutline(ref: VersionRef): Promise<Outline> {
  const key = keyOf(ref)
  const ready = inline.get(key) ?? loaded.get(key)
  if (ready) return Promise.resolve(ready)
  const inFlight = pending.get(key)
  if (inFlight) return inFlight
  const load = loaders.get(key)
  if (!load) return Promise.reject(new Error(`No outline for ${key}`))
  const request = load().then(
    (outline) => {
      loaded.set(key, outline)
      pending.delete(key)
      listeners.forEach((listener) => listener())
      return outline
    },
    (error: unknown) => {
      // Forget the failure (e.g. offline) so the next attempt tries again.
      pending.delete(key)
      throw error
    },
  )
  pending.set(key, request)
  return request
}

/** Calls `listener` whenever a fetched outline arrives. */
export function subscribeToOutlines(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Only outlines that ship with the app: what the server and the first browser render can draw. */
export function peekInlineOutline(ref: VersionRef): Outline | null {
  return inline.get(keyOf(ref)) ?? null
}
