import { MandalaArt } from '@/components/coloring/mandala-art'
import type { Fills } from '@/lib/artwork/library'
import { getMandala, latestVersion } from '@/lib/mandalas'
import type { ColorKey } from '@/lib/palette'
import { cn } from '@/lib/utils'

const logo = latestVersion(getMandala('sunny')!)
const LOGO_COLORS: readonly ColorKey[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple']

const logoFills: Fills = Object.fromEntries(
  logo.regions.map((region, i) => [
    region.id,
    region.id === 'center' ? 'yellow' : LOGO_COLORS[i % LOGO_COLORS.length],
  ]),
)

export function BrandMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <MandalaArt version={logo} fills={logoFills} className={compact ? 'size-9' : 'size-12'} />
      <span className={cn('font-black tracking-tight', compact ? 'text-xl' : 'text-2xl')}>
        漫涂涂
      </span>
    </span>
  )
}
