import { describe, expect, it } from 'vitest'
import {
  CONSENT_WINDOW_MS,
  freshSignInRemainingMs,
  latestSignInAt,
  parseNoticeSections,
} from '@/lib/cloud-consent/notice'

describe('parseNoticeSections', () => {
  it('splits headings and keeps each line as its own paragraph', () => {
    const body = '## What we store\nFirst line.\nSecond line.\n\n## Your choices\nOptional.'
    expect(parseNoticeSections(body)).toEqual([
      { heading: 'What we store', paragraphs: ['First line.', 'Second line.'] },
      { heading: 'Your choices', paragraphs: ['Optional.'] },
    ])
  })

  it('keeps text that appears before the first heading', () => {
    expect(parseNoticeSections('Intro.\r\n## Next\nMore.')).toEqual([
      { heading: null, paragraphs: ['Intro.'] },
      { heading: 'Next', paragraphs: ['More.'] },
    ])
  })
})

describe('latestSignInAt', () => {
  it('uses the most recent sign-in method timestamp', () => {
    const amr = [
      { method: 'otp', timestamp: 1_790_000_000 },
      { method: 'otp', timestamp: 1_790_000_600 },
    ]
    expect(latestSignInAt(amr)?.getTime()).toBe(1_790_000_600_000)
  })

  it('returns null for missing or malformed claims', () => {
    expect(latestSignInAt(undefined)).toBeNull()
    expect(latestSignInAt(['otp'])).toBeNull()
    expect(latestSignInAt([{ method: 'otp', timestamp: 'soon' }])).toBeNull()
  })
})

describe('freshSignInRemainingMs', () => {
  const signedInAt = new Date('2026-09-27T10:00:00Z')

  it('counts down inside the window and stops before the server cutoff', () => {
    const now = signedInAt.getTime() + 60_000
    const remaining = freshSignInRemainingMs(signedInAt, now)
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThan(CONSENT_WINDOW_MS - 60_000)
  })

  it('needs a fresh link once the window has passed or there is no sign-in time', () => {
    expect(freshSignInRemainingMs(signedInAt, signedInAt.getTime() + CONSENT_WINDOW_MS)).toBe(0)
    expect(freshSignInRemainingMs(null, Date.now())).toBe(0)
  })
})
