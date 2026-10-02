import { useEffect, useSyncExternalStore } from 'react'
// Defining the pages registers their outlines. A server component can hand a page to a client
// component before anything else in the browser has loaded the pages, and drawing it then would
// show the placeholder where the server drew the picture: React's hydration mismatch (#418).
import '@/lib/mandalas'
import type { Outline, TemplateVersion } from '@/lib/mandalas'
import { loadOutline, peekInlineOutline, peekOutline, subscribeToOutlines } from '@/lib/templates/outlines'

/**
 * The outline to draw, or null while it's on its way. The server and the first browser render only
 * see outlines that ship with the app, so the page hydrates cleanly; fetched outlines follow.
 * Kept apart from lib/templates/outlines.ts, which server components reach through lib/mandalas.ts.
 */
export function useOutline(ref: Pick<TemplateVersion, 'templateId' | 'version'>): Outline | null {
  const { templateId, version } = ref
  const outline = useSyncExternalStore(
    subscribeToOutlines,
    () => peekOutline({ templateId, version }),
    () => peekInlineOutline({ templateId, version }),
  )
  const missing = outline === null
  useEffect(() => {
    if (!missing) return
    loadOutline({ templateId, version }).catch((error: unknown) => {
      console.error('Loading a picture outline failed', `${templateId}@${version}`, error instanceof Error ? error.message : error)
    })
  }, [templateId, version, missing])
  return outline
}
