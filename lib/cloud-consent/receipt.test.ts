import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  buildConsentReceiptPdf,
  receiptFileName,
  resolveTimeZone,
  signedInAtFromReference,
  type ConsentReceipt,
} from '@/lib/cloud-consent/receipt'

const NOTICE_BODY = [
  '## What cloud saving does',
  'Pictures in "My garden" are copied to your parent account.',
  '## Your choices',
  'You can turn it off at any time in the grown-ups area.',
].join('\n')

function receipt(overrides: Partial<ConsentReceipt> = {}): ConsentReceipt {
  const record = {
    id: '6f1c2a0e-3b7d-4a55-9e8f-2d4b1c0a9e77',
    noticeVersion: 1,
    givenAt: new Date('2026-09-28T12:48:08.479Z'),
    withdrawnAt: null,
    signedInAt: new Date('2026-09-28T12:44:34Z'),
  }
  return {
    parentEmail: 'parent@example.com',
    record,
    notice: {
      version: 1,
      title: "Cloud saving for your child's pictures",
      body: NOTICE_BODY,
      approvedAt: new Date('2026-09-27T08:23:45Z'),
      sha256: '5bd6b14af4d6'.padEnd(64, '0'),
    },
    history: [
      record,
      {
        id: 'a1',
        noticeVersion: 1,
        givenAt: new Date('2026-09-27T10:43:59Z'),
        withdrawnAt: new Date('2026-09-27T10:44:01Z'),
        signedInAt: null,
      },
    ],
    generatedAt: new Date('2026-09-28T13:00:00Z'),
    timeZone: 'America/New_York',
    ...overrides,
  }
}

describe('signedInAtFromReference', () => {
  it('reads the sign-in time the database writes', () => {
    expect(signedInAtFromReference('session:abc;signed_in_at:2026-09-28 12:44:34+00')?.toISOString()).toBe(
      '2026-09-28T12:44:34.000Z',
    )
  })

  it('handles fractional seconds and non-UTC offsets', () => {
    expect(signedInAtFromReference('session:x;signed_in_at:2026-09-28 18:14:34.123456+05:30')?.toISOString()).toBe(
      '2026-09-28T12:44:34.123Z',
    )
  })

  it('returns null when the reference has no sign-in time', () => {
    expect(signedInAtFromReference('session:abc')).toBeNull()
    expect(signedInAtFromReference('signed_in_at:not-a-date')).toBeNull()
  })
})

describe('resolveTimeZone', () => {
  it('keeps a real time zone and falls back to UTC otherwise', () => {
    expect(resolveTimeZone('America/New_York')).toBe('America/New_York')
    expect(resolveTimeZone('Not/AZone')).toBe('UTC')
    expect(resolveTimeZone(null)).toBe('UTC')
    expect(resolveTimeZone('x'.repeat(65))).toBe('UTC')
  })
})

describe('receiptFileName', () => {
  it('uses the day of agreement in the parent’s time zone', () => {
    const givenAt = new Date('2026-09-28T02:00:00Z')
    expect(receiptFileName(givenAt, 'America/Los_Angeles')).toBe('mantutu-cloud-saving-permission-2026-09-27.pdf')
    expect(receiptFileName(givenAt, 'UTC')).toBe('mantutu-cloud-saving-permission-2026-09-28.pdf')
  })
})

describe('buildConsentReceiptPdf', () => {
  it('creates a titled PDF', async () => {
    const bytes = await buildConsentReceiptPdf(receipt())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getTitle()).toBe('云端保存授权记录')
    expect(doc.getAuthor()).toBe('SmartMango')
  })

  it('flows a long notice onto more pages', async () => {
    const longBody = Array.from({ length: 12 }, (_, i) => `## Part ${i + 1}\n${'Plain words about saving. '.repeat(40)}`).join(
      '\n',
    )
    const short = await PDFDocument.load(await buildConsentReceiptPdf(receipt()))
    const long = await PDFDocument.load(
      await buildConsentReceiptPdf(receipt({ notice: { ...receipt().notice, body: longBody } })),
    )
    expect(long.getPageCount()).toBeGreaterThan(short.getPageCount() + 1)
  })

  it('does not fail on characters the built-in fonts cannot print', async () => {
    await expect(buildConsentReceiptPdf(receipt({ parentEmail: '家长@例子.com 🌼' }))).resolves.toBeInstanceOf(Uint8Array)
  })
})
