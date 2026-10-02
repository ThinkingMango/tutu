'use client'

import { useLayoutEffect, type ReactNode } from 'react'
import { isGrownUpDocument } from '@/lib/grown-up-scripts'

/**
 * Children's screens never share a page with grown-up scripts. Arriving here from a grown-up page
 * without a full load (a link or the browser's Back button) reloads the page first, which unloads
 * Stripe.js and analytics, and shows nothing until then.
 */
export function GrownUpScriptGuard({ children }: { children: ReactNode }) {
  const marked = isGrownUpDocument()

  useLayoutEffect(() => {
    if (marked) window.location.replace(window.location.href)
  }, [marked])

  if (marked) return <div className="min-h-dvh bg-background" aria-busy="true" />
  return children
}
