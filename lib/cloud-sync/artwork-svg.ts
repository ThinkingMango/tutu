import type { Fills } from '@/lib/artwork/library'
import type { Outline, TemplateVersion } from '@/lib/mandalas'
import type { ColorKey } from '@/lib/palette'

/** sRGB versions of the palette tokens in globals.css, so the file looks right outside the app. */
const FILE_COLORS: Record<ColorKey, string> = {
  red: '#f54748',
  pink: '#f893bc',
  orange: '#fd9836',
  peach: '#f8c19c',
  yellow: '#fcd936',
  lime: '#aee659',
  green: '#3fc168',
  sky: '#77d2f5',
  blue: '#3797e9',
  purple: '#9860d0',
  brown: '#9a633b',
  gray: '#a1a5ab',
  'rose-pale': '#fbd5dd',
  'rose-soft': '#f49db2',
  'rose-mid': '#e0566f',
  'rose-deep': '#a3304a',
  'sun-pale': '#fdeba5',
  'sun-soft': '#f8c940',
  'sun-mid': '#f08c2c',
  'sun-deep': '#b85a22',
  'leaf-pale': '#e0f0b4',
  'leaf-soft': '#a9d56a',
  'leaf-mid': '#58ab52',
  'leaf-deep': '#2f7747',
  'sea-pale': '#c8ecf0',
  'sea-soft': '#63c6d2',
  'sea-mid': '#3190c6',
  'sea-deep': '#2c58a3',
  'violet-pale': '#e4d9f5',
  'violet-soft': '#b89de3',
  'violet-mid': '#8a5ec6',
  'violet-deep': '#5d3b90',
  'earth-pale': '#efe4d1',
  'earth-soft': '#bdb5aa',
  'earth-mid': '#a26d48',
  'earth-deep': '#604434',
}
const CANVAS = '#ffffff'
const INK = '#242b3b'

/**
 * A standalone image of one garden picture, drawn exactly like the garden tile. Takes the outline
 * explicitly (see `loadOutline`), so a picture can't be drawn before its outline has arrived.
 */
export function renderArtworkSvg(version: TemplateVersion, outline: Outline, fills: Fills) {
  const paths = outline.regions
    .map((region) => {
      const color = fills[region.id]
      const fill = color ? FILE_COLORS[color] : CANVAS
      return `<path d="${region.d}" fill="${fill}"/>`
    })
    .join('')
  const details = outline.details
    .map((detail) =>
      detail.kind === 'dot'
        ? `<path d="${detail.d}" fill="${INK}" stroke="none"/>`
        : `<path d="${detail.d}" fill="none"/>`,
    )
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 1048 1048" width="1048" height="1048">` +
    `<rect x="-24" y="-24" width="1048" height="1048" fill="${CANVAS}"/>` +
    `<g stroke="${INK}" stroke-width="${version.line === 'fine' ? 6 : 14}" stroke-linejoin="round" stroke-linecap="round">${paths}${details}</g>` +
    `</svg>`
  )
}
