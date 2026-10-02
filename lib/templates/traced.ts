import type { Drawing, RawOutline, TemplateDefinition } from '@/lib/mandalas'
import type { PackIconName } from '@/lib/pack-icons'
import type { PackId } from '@/lib/packs'
import { EARLIER_DRAWINGS } from '@/lib/templates/earlier-drawings'
import { TRACED_PACK_SOURCES } from '@/lib/templates/registry.generated'

export type PackStatus = 'draft' | 'published'

/** Who a pack is drawn for. Grown-up pages are finer and get the 24-color palette. */
export type PackAudience = 'children' | 'grown-ups'

/**
 * A traced page as the registry lists it. The areas and their spoken names are listed inline, since
 * every screen needs them; the outline, nearly all of a page's size, is fetched when it's drawn.
 */
export type TracedPage = Readonly<{
  id: string
  name: string
  /** Written only for grown-up pages; bold is the default. */
  line?: 'fine'
  /** `[id, spoken name]` for every area, in drawing order. */
  regions: readonly (readonly [string, string])[]
  outline: () => Promise<{ default: RawOutline }>
}>

/** A pack made from art/<pack>, as listed in the generated registry. */
export type TracedPackSource = Readonly<{
  id: string
  name: string
  description: string
  icon: PackIconName
  status: PackStatus
  /** Written only for grown-up packs; children is the default. */
  audience?: 'grown-ups'
  pages: readonly TracedPage[]
}>

export type TracedPack = Omit<TracedPackSource, 'id'> & { id: (typeof TRACED_PACK_SOURCES)[number]['id'] }

/**
 * Draft packs are listed while developing, including in the v0 preview, so they can be tried before
 * they're published. Production builds and tests only list published packs.
 */
export const SHOW_DRAFT_PACKS = process.env.NODE_ENV === 'development'

export const TRACED_PACKS: readonly TracedPack[] = TRACED_PACK_SOURCES

export const LISTED_TRACED_PACKS: readonly TracedPack[] = TRACED_PACKS.filter(
  (pack) => pack.status === 'published' || SHOW_DRAFT_PACKS,
)

/**
 * A paid page in a traced pack. Earlier drawings for pages that shipped before their traced art stay
 * as the first versions, so saved artwork keeps opening on the version it was started on.
 */
export function tracedPage(pack: PackId, page: TracedPage, earlier: readonly Drawing[] = []): TemplateDefinition {
  return {
    id: page.id,
    name: page.name,
    tier: 'paid',
    pack,
    versions: [
      ...earlier.map((drawing, index) => ({ version: index + 1, drawing })),
      {
        version: earlier.length + 1,
        regions: page.regions.map(([id, label]) => ({ id, label })),
        line: page.line,
        load: () => page.outline().then((module) => module.default),
      },
    ],
  }
}

export function listedTracedPages(): TemplateDefinition[] {
  return LISTED_TRACED_PACKS.flatMap((pack) =>
    pack.pages.map((page) => tracedPage(pack.id, page, EARLIER_DRAWINGS[page.id])),
  )
}
