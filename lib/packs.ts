import { MANDALAS, type Mandala } from '@/lib/mandalas'
import type { PackIconName } from '@/lib/pack-icons'
import {
  LISTED_TRACED_PACKS,
  TRACED_PACKS,
  type PackAudience,
  type PackStatus,
  type TracedPack,
} from '@/lib/templates/traced'

/** Standard, plus every pack in art/. Add a pack with `pnpm packs new`; see art/README.md. */
export type PackId = 'standard' | TracedPack['id']

export type Pack = Readonly<{
  /** For packs sold separately, this matches `entitlements.pack_id`, written by the billing server. */
  id: PackId
  name: string
  description: string
  icon: PackIconName
  /** Draft packs are listed only while developing. */
  status: PackStatus
  audience: PackAudience
  /** Where the artwork came from, kept with the pack as its art record. */
  artSource: string
  /**
   * Whether the pack can be bought once on its own. Paid pages in other packs unlock only with a plan,
   * even if an entitlement row names that pack.
   */
  soldSeparately: boolean
}>

const STANDARD: Pack = {
  id: 'standard',
  name: 'Standard',
  description: '十幅花朵曼陀罗。其中四幅人人免费，另外六幅一次性解锁即可使用。',
  icon: 'flower-2',
  status: 'published',
  audience: 'children',
  artSource: '为漫涂涂用代码绘制的原创几何图案。未使用任何第三方图片或授权。',
  soldSeparately: false,
}

function tracedPack(source: TracedPack): Pack {
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    icon: source.icon,
    status: source.status,
    audience: source.audience ?? 'children',
    artSource: `为漫涂涂使用 v0 图像生成制作的原创线稿，再由 scripts/trace-pack.mjs 描摹成可点按填色的区域。每张源图及其校验值均保存在 art/${source.id}/source 中。未使用任何第三方图片或授权。`,
    soldSeparately: true,
  }
}

/** Every pack, drafts included, so a page can always find its pack. */
export const PACK_BY_ID = Object.freeze(
  Object.fromEntries([STANDARD, ...TRACED_PACKS.map(tracedPack)].map((pack) => [pack.id, pack])),
) as Readonly<Record<PackId, Pack>>

/**
 * Grown-up packs are shelved: they are not listed, sold or opened anywhere. Their art, pages and
 * code stay in place, so setting this to true brings back the "Your coloring" tab, the "For you"
 * groups on Overview and Pricing, and the /parent/grown-ups and /parent/color routes.
 */
export const GROWN_UPS_OFFERED = false

/** Every listed pack in shelf order. Grown-up packs are included only while they are offered. */
export const PACKS: readonly Pack[] = Object.freeze(
  [STANDARD, ...LISTED_TRACED_PACKS.map((p) => PACK_BY_ID[p.id])].filter(
    (p) => p.audience === 'children' || GROWN_UPS_OFFERED,
  ),
)

/** The packs on the kids' shelf. */
export const KIDS_PACKS: readonly Pack[] = Object.freeze(PACKS.filter((p) => p.audience === 'children'))

/** Packs made for adults. They are listed and colored only behind the parent gate. */
export const GROWN_UP_PACKS: readonly Pack[] = Object.freeze(PACKS.filter((p) => p.audience === 'grown-ups'))

export const GROWN_UPS_HREF = '/parent/grown-ups'

export function isGrownUpPage(mandala: Pick<Mandala, 'pack'>) {
  return PACK_BY_ID[mandala.pack].audience === 'grown-ups'
}

/** Published packs a parent can buy once and keep. */
export const SOLD_PACKS: readonly Pack[] = Object.freeze(
  PACKS.filter((p) => p.soldSeparately && p.status === 'published'),
)

/** Sold packs split for Pricing: kids' packs first, grown-up packs in their own "For you" group. */
export const SOLD_KIDS_PACKS: readonly Pack[] = Object.freeze(SOLD_PACKS.filter((p) => p.audience === 'children'))
export const SOLD_GROWN_UP_PACKS: readonly Pack[] = Object.freeze(
  SOLD_PACKS.filter((p) => p.audience === 'grown-ups'),
)

export const FOR_YOU_ANCHOR = 'for-you'

export function findKidsPack(id: string): Pack | undefined {
  return KIDS_PACKS.find((p) => p.id === id)
}

export function packHref(id: PackId) {
  return PACK_BY_ID[id].audience === 'grown-ups' ? GROWN_UPS_HREF : `/packs/${id}`
}

/** Grown-up pages open under /parent so the gate guards them; the kids' area never links there. */
export function colorHref(mandala: Pick<Mandala, 'id' | 'pack'>) {
  return isGrownUpPage(mandala) ? `/parent/color/${mandala.id}` : `/color/${mandala.id}`
}

/** The published pages in a pack. Counts shown to parents always come from here. */
export function packPages(id: PackId): Mandala[] {
  return MANDALAS.filter((m) => m.pack === id)
}
