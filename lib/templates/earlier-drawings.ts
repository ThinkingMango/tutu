import type { Drawing } from '@/lib/mandalas'
import { OCEAN_FRIENDS_CODE_DRAWINGS } from '@/lib/templates/ocean-friends'

/**
 * Drawings that shipped before a page's traced art, oldest first, keyed by page id. They stay as the
 * page's first versions so saved artwork keeps opening on the drawing it was started on. Never remove
 * or reorder an entry once it has shipped.
 */
export const EARLIER_DRAWINGS: Readonly<Record<string, readonly Drawing[]>> = {
  ...OCEAN_FRIENDS_CODE_DRAWINGS,
}
