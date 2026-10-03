import { PDFDocument, rgb } from 'pdf-lib'
import { embedCjkFonts, fetchCjkFonts, printableWith, type CjkFontBytes } from '@/lib/pdf/cjk-fonts'

export type PdfPicture = Readonly<{
  name: string
  /** Already formatted for the parent's locale, e.g. "2026年3月3日". */
  dateLabel: string
  /** PNG bytes of the colored picture, square. */
  png: Uint8Array
}>

const PAGE = { width: 612, height: 792 }
const MARGIN = 54
const INK = rgb(0.141, 0.169, 0.231)
const MUTED = rgb(0.42, 0.45, 0.52)

/** Normalizes punctuation and drops characters (like emoji) that no embedded font covers, rather than failing the export. */
export function pdfSafeText(text: string) {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u2E80-\u9FFF\uFF00-\uFFEF]/g, '')
    .trim()
}

/** One US Letter page per picture: the name on top, the picture centered, the date underneath. */
export async function buildPicturesPdf(
  pictures: readonly PdfPicture[],
  now = new Date(),
  fontBytes?: CjkFontBytes,
) {
  if (pictures.length === 0) throw new Error('没有可导出的图画')
  const pdf = await PDFDocument.create()
  pdf.setTitle('Little Mandala 图画')
  pdf.setCreator('Little Mandala')
  pdf.setProducer('Little Mandala')
  pdf.setCreationDate(now)
  pdf.setModificationDate(now)

  const { regular, bold } = await embedCjkFonts(pdf, fontBytes ?? (await fetchCjkFonts()))
  const artSize = PAGE.width - MARGIN * 2
  const artBottom = (PAGE.height - artSize) / 2 - 12

  for (const picture of pictures) {
    const page = pdf.addPage([PAGE.width, PAGE.height])
    const image = await pdf.embedPng(picture.png)
    page.drawImage(image, { x: MARGIN, y: artBottom, width: artSize, height: artSize })

    const title = printableWith(bold, pdfSafeText(picture.name)) || '花园图画'
    const titleSize = 22
    page.drawText(title, {
      x: (PAGE.width - bold.widthOfTextAtSize(title, titleSize)) / 2,
      y: artBottom + artSize + 28,
      size: titleSize,
      font: bold,
      color: INK,
    })

    const caption = printableWith(regular, pdfSafeText(`涂色于 ${picture.dateLabel}`))
    const captionSize = 12
    page.drawText(caption, {
      x: (PAGE.width - regular.widthOfTextAtSize(caption, captionSize)) / 2,
      y: artBottom - 30,
      size: captionSize,
      font: regular,
      color: MUTED,
    })

    const footer = 'Little Mandala'
    page.drawText(footer, {
      x: (PAGE.width - regular.widthOfTextAtSize(footer, 9)) / 2,
      y: MARGIN / 2,
      size: 9,
      font: regular,
      color: MUTED,
    })
  }

  return pdf.save()
}

export function picturesPdfFileName(now = new Date()) {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-')
  return `little-mandala-pictures-${day}.pdf`
}
