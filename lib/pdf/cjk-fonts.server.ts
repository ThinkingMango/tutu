import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { CJK_FONT_FILES, type CjkFontBytes } from '@/lib/pdf/cjk-fonts'

let cached: Promise<CjkFontBytes> | null = null

/** Reads the PDF fonts from public/fonts. next.config.mjs traces them into the receipt function. */
export function readCjkFonts(): Promise<CjkFontBytes> {
  cached ??= (async () => {
    const dir = path.join(process.cwd(), 'public', 'fonts')
    const [regular, bold] = await Promise.all([
      readFile(path.join(dir, CJK_FONT_FILES.regular)),
      readFile(path.join(dir, CJK_FONT_FILES.bold)),
    ])
    return { regular: new Uint8Array(regular), bold: new Uint8Array(bold) }
  })().catch((error) => {
    cached = null
    throw error
  })
  return cached
}
