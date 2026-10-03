import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { buildPicturesPdf, pdfSafeText, picturesPdfFileName } from '@/lib/export/pictures-pdf'
import { readCjkFonts } from '@/lib/pdf/cjk-fonts.server'

const PIXEL = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0),
)

describe('buildPicturesPdf', () => {
  it('makes one Letter page per picture', async () => {
    const bytes = await buildPicturesPdf(
      [
        { name: '星光花', dateLabel: '2026年3月3日', png: PIXEL },
        { name: '雪狐', dateLabel: '2026年3月4日', png: PIXEL },
      ],
      new Date(),
      await readCjkFonts(),
    )
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBe(2)
    expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 })
    expect(pdf.getTitle()).toBe('Little Mandala 图画')
    expect(pdf.getAuthor()).toBeUndefined()
  })

  it('handles names the fonts cannot draw', async () => {
    const bytes = await buildPicturesPdf(
      [{ name: 'Rosa’s 花园 🌸', dateLabel: '3 mars 2026', png: PIXEL }],
      new Date(),
      await readCjkFonts(),
    )
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })

  it('refuses an empty export', async () => {
    await expect(buildPicturesPdf([])).rejects.toThrow()
  })
})

describe('pdf helpers', () => {
  it('keeps Latin and Chinese text and drops what the font cannot draw', () => {
    expect(pdfSafeText('Rosa’s “Garden” — 🌸')).toBe('Rosa\'s "Garden" -')
    expect(pdfSafeText('Crème brûlée')).toBe('Crème brûlée')
    expect(pdfSafeText('星光花 🌸')).toBe('星光花')
  })

  it('names the file after the day', () => {
    expect(picturesPdfFileName(new Date(2026, 8, 7))).toBe('little-mandala-pictures-2026-09-07.pdf')
  })
})
