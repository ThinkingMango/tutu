import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { agreementStatement, parseNoticeSections } from '@/lib/cloud-consent/notice'
import { OPERATOR_NAME, SUPPORT_EMAIL } from '@/lib/legal'

export type ReceiptRecord = {
  id: string
  noticeVersion: number
  givenAt: Date
  withdrawnAt: Date | null
  signedInAt: Date | null
}

export type ReceiptNotice = { version: number; title: string; body: string; approvedAt: Date; sha256: string }

export type ConsentReceipt = {
  parentEmail: string
  record: ReceiptRecord
  notice: ReceiptNotice
  history: ReceiptRecord[]
  generatedAt: Date
  timeZone: string
}

/** Matches the `signed_in_at:` part written by give_cloud_consent(), e.g. `2026-09-28 12:44:34+00`. */
const SIGNED_IN_AT = /(?:^|;)signed_in_at:(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?([+-]\d{2})(?::?(\d{2}))?$/

export function signedInAtFromReference(reference: string): Date | null {
  const match = SIGNED_IN_AT.exec(reference)
  if (!match) return null
  const [, day, time, fraction = '', hours, minutes = '00'] = match
  const date = new Date(`${day}T${time}${fraction.slice(0, 4)}${hours}:${minutes}`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function resolveTimeZone(value: string | null | undefined): string {
  if (!value || value.length > 64) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return value
  } catch {
    return 'UTC'
  }
}

export function formatReceiptTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'long', timeZone }).format(date)
}

function formatReceiptDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone }).format(date)
}

function formatUtc(date: Date) {
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`
}

export function receiptFileName(givenAt: Date, timeZone: string) {
  const day = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(
    givenAt,
  )
  return `little-mandala-cloud-saving-permission-${day}.pdf`
}

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 56
const FOOTER_SPACE = 36
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const LABEL_WIDTH = 150

const COLORS = {
  primary: rgb(0.037, 0.415, 0.795),
  text: rgb(0.141, 0.169, 0.23),
  muted: rgb(0.34, 0.367, 0.424),
  rule: rgb(0.877, 0.89, 0.917),
  panel: rgb(0.945, 0.955, 0.974),
}

type Fonts = { regular: PDFFont; bold: PDFFont; mono: PDFFont }
type TextStyle = { font: PDFFont; size: number; color: RGB; leading?: number }
type RowValue = { text: string; style?: Partial<TextStyle> }

const UNUSUAL_SPACES = /[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g

/** The built-in PDF fonts only cover Western European characters; anything else prints as "?". */
function printable(font: PDFFont, text: string) {
  let out = ''
  for (const char of text.replace(UNUSUAL_SPACES, ' ')) {
    try {
      font.encodeText(char)
      out += char
    } catch {
      out += '?'
    }
  }
  return out
}

function splitLongWord(font: PDFFont, size: number, word: string, width: number) {
  if (font.widthOfTextAtSize(word, size) <= width) return [word]
  const parts: string[] = []
  let part = ''
  for (const char of word) {
    if (part && font.widthOfTextAtSize(part + char, size) > width) {
      parts.push(part)
      part = char
    } else {
      part += char
    }
  }
  if (part) parts.push(part)
  return parts
}

function wrap(font: PDFFont, size: number, text: string, width: number) {
  const lines: string[] = []
  let line = ''
  for (const word of printable(font, text).split(/\s+/).filter(Boolean)) {
    for (const piece of splitLongWord(font, size, word, width)) {
      const candidate = line ? `${line} ${piece}` : piece
      if (!line || font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate
      } else {
        lines.push(line)
        line = piece
      }
    }
  }
  if (line) lines.push(line)
  return lines
}

class PdfWriter {
  page: PDFPage
  y = PAGE_HEIGHT - MARGIN

  constructor(
    private readonly doc: PDFDocument,
    readonly fonts: Fonts,
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  }

  private ensure(height: number) {
    if (this.y - height >= MARGIN + FOOTER_SPACE) return
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.y = PAGE_HEIGHT - MARGIN
  }

  gap(height: number) {
    this.y -= height
  }

  text(text: string, style: TextStyle, x = MARGIN, width = CONTENT_WIDTH) {
    const leading = style.leading ?? style.size * 1.5
    for (const line of wrap(style.font, style.size, text, width)) {
      this.ensure(leading)
      this.page.drawText(line, { x, y: this.y - style.size, size: style.size, font: style.font, color: style.color })
      this.y -= leading
    }
  }

  rule() {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.75,
      color: COLORS.rule,
    })
  }

  /** A label on the left and one or more value lines on the right, kept together on one page. */
  row(label: string, values: RowValue[]) {
    const leading = 15
    const labelStyle: TextStyle = { font: this.fonts.bold, size: 9.5, color: COLORS.muted }
    const labelLines = wrap(labelStyle.font, labelStyle.size, label, LABEL_WIDTH - 16)
    const blocks = values.map(({ text, style }) => {
      const resolved: TextStyle = { font: this.fonts.regular, size: 10, color: COLORS.text, ...style }
      return { style: resolved, lines: wrap(resolved.font, resolved.size, text, CONTENT_WIDTH - LABEL_WIDTH) }
    })
    const valueLineCount = blocks.reduce((count, block) => count + block.lines.length, 0)
    const height = Math.max(labelLines.length, valueLineCount) * leading + 14

    this.ensure(height)
    const top = this.y - 8
    labelLines.forEach((line, index) =>
      this.page.drawText(line, { x: MARGIN, y: top - 10 - index * leading, ...labelStyle }),
    )
    let index = 0
    for (const { style, lines } of blocks) {
      for (const line of lines) {
        this.page.drawText(line, {
          x: MARGIN + LABEL_WIDTH,
          y: top - 10 - index * leading,
          size: style.size,
          font: style.font,
          color: style.color,
        })
        index++
      }
    }
    this.y -= height
    this.rule()
  }

  panel(text: string, style: TextStyle) {
    const padding = 14
    const leading = style.leading ?? style.size * 1.5
    const lines = wrap(style.font, style.size, text, CONTENT_WIDTH - padding * 2)
    const height = lines.length * leading + padding * 2 - (leading - style.size) + 4
    this.ensure(height)
    this.page.drawRectangle({ x: MARGIN, y: this.y - height, width: CONTENT_WIDTH, height, color: COLORS.panel })
    lines.forEach((line, index) =>
      this.page.drawText(line, {
        x: MARGIN + padding,
        y: this.y - padding - style.size - index * leading + 2,
        size: style.size,
        font: style.font,
        color: style.color,
      }),
    )
    this.y -= height
  }
}

function drawFooters(doc: PDFDocument, fonts: Fonts) {
  const pages = doc.getPages()
  const size = 8.5
  pages.forEach((page, index) => {
    const y = MARGIN - 26
    page.drawLine({
      start: { x: MARGIN, y: y + 16 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 16 },
      thickness: 0.75,
      color: COLORS.rule,
    })
    page.drawText('Little Mandala · Cloud saving permission record', {
      x: MARGIN,
      y,
      size,
      font: fonts.regular,
      color: COLORS.muted,
    })
    const pageLabel = `Page ${index + 1} of ${pages.length}`
    page.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN - fonts.regular.widthOfTextAtSize(pageLabel, size),
      y,
      size,
      font: fonts.regular,
      color: COLORS.muted,
    })
  })
}

export async function buildConsentReceiptPdf(receipt: ConsentReceipt): Promise<Uint8Array> {
  const { record, notice, timeZone } = receipt
  const doc = await PDFDocument.create()
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.Courier),
  }
  const { regular, bold, mono } = fonts
  const muted = (size: number): Partial<TextStyle> => ({ font: regular, size, color: COLORS.muted })

  doc.setTitle('Cloud saving permission record')
  doc.setSubject(`Permission for cloud saving, notice version ${notice.version}`)
  doc.setAuthor(OPERATOR_NAME)
  doc.setCreator('Little Mandala')
  doc.setProducer('Little Mandala')
  doc.setCreationDate(receipt.generatedAt)
  doc.setModificationDate(receipt.generatedAt)

  const pdf = new PdfWriter(doc, fonts)

  pdf.text('LITTLE MANDALA', { font: bold, size: 9, color: COLORS.primary })
  pdf.gap(4)
  pdf.text('Cloud saving permission record', { font: bold, size: 22, color: COLORS.text, leading: 28 })
  pdf.text('Your permission for cloud saving, with the exact notice you agreed to.', {
    font: regular,
    size: 11,
    color: COLORS.muted,
  })
  pdf.gap(14)
  pdf.text(
    record.withdrawnAt
      ? `Permission withdrawn on ${formatReceiptDate(record.withdrawnAt, timeZone)}`
      : 'Permission is active',
    { font: bold, size: 12, color: record.withdrawnAt ? COLORS.text : COLORS.primary },
  )
  pdf.gap(6)
  pdf.rule()

  pdf.row('Parent account', [{ text: receipt.parentEmail }])
  pdf.row('Permission for', [{ text: 'Cloud saving of the pictures in My garden' }])
  pdf.row('Agreed on', [
    { text: formatReceiptTime(record.givenAt, timeZone), style: { font: bold } },
    { text: formatUtc(record.givenAt), style: muted(9) },
  ])
  pdf.row('Notice agreed to', [
    { text: `Version ${notice.version}: ${notice.title}` },
    { text: `Approved ${formatReceiptDate(notice.approvedAt, timeZone)}`, style: muted(9) },
  ])
  pdf.row('How it was confirmed', [
    { text: 'Signed in with a fresh sign-in email (its link or code), then ticked the agreement box.' },
    ...(record.signedInAt
      ? [{ text: `Email sign-in used: ${formatReceiptTime(record.signedInAt, timeZone)}`, style: muted(9) }]
      : []),
  ])
  pdf.row('Status', [
    {
      text: record.withdrawnAt
        ? `Withdrawn on ${formatReceiptTime(record.withdrawnAt, timeZone)}`
        : 'Active. It stays in effect until you turn off cloud saving.',
    },
  ])
  pdf.row('Record reference', [{ text: record.id, style: { font: mono, size: 9 } }])
  pdf.row('Notice fingerprint', [
    { text: notice.sha256, style: { font: mono, size: 8.5 } },
    { text: 'SHA-256 of the notice text below. Any change to the wording changes it.', style: muted(9) },
  ])

  pdf.gap(22)
  pdf.text('What you ticked', { font: bold, size: 13, color: COLORS.text })
  pdf.gap(4)
  pdf.panel(`“${agreementStatement(notice.version)}”`, { font: regular, size: 10.5, color: COLORS.text, leading: 16 })

  pdf.gap(24)
  pdf.text('The notice you agreed to', { font: bold, size: 13, color: COLORS.text })
  pdf.gap(2)
  pdf.text(`${notice.title} · Version ${notice.version} · Approved ${formatReceiptDate(notice.approvedAt, timeZone)}`, {
    font: regular,
    size: 9.5,
    color: COLORS.muted,
  })
  for (const section of parseNoticeSections(notice.body)) {
    pdf.gap(10)
    if (section.heading) pdf.text(section.heading, { font: bold, size: 10.5, color: COLORS.text, leading: 16 })
    for (const paragraph of section.paragraphs) {
      pdf.text(paragraph, { font: regular, size: 10, color: COLORS.text, leading: 15 })
      pdf.gap(3)
    }
  }

  if (receipt.history.length > 1) {
    pdf.gap(22)
    pdf.text('Permission history', { font: bold, size: 13, color: COLORS.text })
    pdf.text('Every time cloud saving was turned on for this account, newest first.', {
      font: regular,
      size: 9.5,
      color: COLORS.muted,
    })
    pdf.gap(6)
    pdf.rule()
    for (const entry of receipt.history) {
      pdf.row(`Notice version ${entry.noticeVersion}`, [
        { text: `Agreed ${formatReceiptTime(entry.givenAt, timeZone)}` },
        {
          text: entry.withdrawnAt ? `Withdrawn ${formatReceiptTime(entry.withdrawnAt, timeZone)}` : 'Still active',
          style: muted(9),
        },
      ])
    }
  }

  pdf.gap(22)
  pdf.text(
    `Created ${formatReceiptTime(receipt.generatedAt, timeZone)} from ${OPERATOR_NAME}’s records for ${receipt.parentEmail}. Times are shown in ${timeZone}. ${OPERATOR_NAME} operates Little Mandala. Questions: ${SUPPORT_EMAIL}.`,
    { font: regular, size: 9, color: COLORS.muted, leading: 14 },
  )

  drawFooters(doc, fonts)
  return doc.save()
}
