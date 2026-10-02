import type { CSSProperties } from 'react'
import { KIDS_PACKS, type PackId } from '@/lib/packs'

/** The kids' crayons a pack can wear. Brown and gray are left out: they read as "switched off". */
export type Crayon = 'red' | 'pink' | 'orange' | 'peach' | 'yellow' | 'lime' | 'green' | 'sky' | 'blue' | 'purple'

/** Each pack keeps one crayon everywhere it appears, so children can find it again by color alone. */
const PACK_CRAYONS: Readonly<Record<string, Crayon>> = {
  standard: 'pink',
  'ocean-friends': 'sky',
  'safari-garden': 'orange',
  'easter-garden': 'lime',
  'christmas-garden': 'red',
  'flowers-garden': 'purple',
  'ocean-friends-two': 'blue',
  'safari-garden-two': 'peach',
  'christmas-garden-two': 'green',
  'surprise-garden': 'pink',
  'zen-mandalas': 'purple',
}

/** New packs take the next crayon in shelf order, so neighbours never match. */
const ROTATION: readonly Crayon[] = ['pink', 'sky', 'orange', 'lime', 'red', 'purple', 'blue', 'peach', 'green', 'yellow']

export const GARDEN_CRAYON: Crayon = 'green'

export function packCrayon(id: PackId): Crayon {
  const named = PACK_CRAYONS[id]
  if (named) return named
  const index = Math.max(0, KIDS_PACKS.findIndex((pack) => pack.id === id))
  return ROTATION[index % ROTATION.length]
}

/** Sets `--pack` for the `pack-theme` utility and any `bg-(--pack)` inside it. */
export function crayonStyle(crayon: Crayon): CSSProperties {
  return { '--pack': `var(--swatch-${crayon})` } as CSSProperties
}

export function packThemeStyle(id: PackId): CSSProperties {
  return crayonStyle(packCrayon(id))
}
