'use client'

import { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { grownUpEventsOnly } from '@/lib/audience-routes'
import { markGrownUpDocument } from '@/lib/grown-up-scripts'

/**
 * Page-visit counts for the parent area and policy pages. Never mounted on children's screens, and
 * marks the page so a later children's screen reloads first instead of inheriting the script.
 */
export function GrownUpAnalytics() {
  useEffect(markGrownUpDocument, [])
  if (process.env.NODE_ENV !== 'production') return null
  return <Analytics beforeSend={grownUpEventsOnly} />
}
