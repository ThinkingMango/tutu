import fontkit from '@pdf-lib/fontkit'
import type { PDFDocument, PDFFont } from 'pdf-lib'

/**
 * Noto Sans SC, subset to GB2312 plus every Chinese character used in the app (see public/fonts).
 * The built-in PDF fonts only cover Latin-1, so Chinese text needs an embedded font.
 */
export const CJK_FONT_FILES = { regular: 'NotoSansSC-Regular.otf', bold: 'NotoSansSC-Bold.otf' } as const

export type CjkFontBytes = { regular: Uint8Array; bold: Uint8Array }

export async function fetchCjkFonts(base = '/fonts/'): Promise<CjkFontBytes> {
  const load = async (file: string) => {
    const response = await fetch(`${base}${file}`)
    if (!response.ok) throw new Error('无法加载 PDF 字体')
    return new Uint8Array(await response.arrayBuffer())
  }
  const [regular, bold] = await Promise.all([load(CJK_FONT_FILES.regular), load(CJK_FONT_FILES.bold)])
  return { regular, bold }
}

export async function embedCjkFonts(doc: PDFDocument, bytes: CjkFontBytes) {
  doc.registerFontkit(fontkit)
  // Full embedding: pdf-lib's subsetter mangles CFF-based OpenType fonts like Noto Sans SC.
  const [regular, bold] = await Promise.all([
    doc.embedFont(bytes.regular, { subset: false }),
    doc.embedFont(bytes.bold, { subset: false }),
  ])
  return { regular, bold }
}

const charsetCache = new WeakMap<PDFFont, Set<number>>()

/** Keeps characters the font can draw and swaps the rest for `fallback`. */
export function printableWith(font: PDFFont, text: string, fallback = '') {
  let charset = charsetCache.get(font)
  if (!charset) {
    charset = new Set(font.getCharacterSet())
    charsetCache.set(font, charset)
  }
  let out = ''
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    out += code === 0x20 || charset.has(code) ? char : fallback
  }
  return out
}
