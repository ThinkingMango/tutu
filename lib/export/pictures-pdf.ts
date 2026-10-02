import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export type PdfPicture = Readonly<{
  name: string
  /** Already formatted for the parent's locale, e.g. "March 3, 2026". */
  dateLabel: string
  /** PNG bytes of the colored picture, square. */
  png: Uint8Array
}>

const PAGE = { width: 612, height: 792 }
const MARGIN = 54
const INK = rgb(0.141, 0.169, 0.231)
const MUTED = rgb(0.42, 0.45, 0.52)

/** The standard PDF fonts only cover Latin-1, so anything else is swapped or dropped rather than failing the export. */
export function pdfSafeText(text: string) {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '')
    .trim()
}

/** One US Letter page per picture: the name on top, the picture centered, the date underneath. */
export async function buildPicturesPdf(pictures: readonly PdfPicture[], now = new Date()) {
  if (pictures.length === 0) throw new Error('No pictures to export')
  const pdf = await PDFDocument.create()
  pdf.setTitle('Little Mandala pictures')
  pdf.setCreator('Little Mandala')
  pdf.setProducer('Little Mandala')
  pdf.setCreationDate(now)
  pdf.setModificationDate(now)

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const artSize = PAGE.width - MARGIN * 2
  const artBottom = (PAGE.height - artSize) / 2 - 12

  for (const picture of pictures) {
    const page = pdf.addPage([PAGE.width, PAGE.height])
    const image = await pdf.embedPng(picture.png)
    page.drawImage(image, { x: MARGIN, y: artBottom, width: artSize, height: artSize })

    const title = pdfSafeText(picture.name) || 'Garden picture'
    const titleSize = 22
    page.drawText(title, {
      x: (PAGE.width - bold.widthOfTextAtSize(title, titleSize)) / 2,
      y: artBottom + artSize + 28,
      size: titleSize,
      font: bold,
      color: INK,
    })

    const caption = pdfSafeText(`Colored on ${picture.dateLabel}`)
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
