'use client'

import type { KeyboardEvent, MouseEvent } from 'react'
import type { Fills } from '@/lib/artwork/library'
import type { RegionInfo, TemplateVersion } from '@/lib/mandalas'
import { colorLabel, colorVar } from '@/lib/palette'
import { useOutline } from '@/lib/templates/use-outline'
import { cn } from '@/lib/utils'

type MandalaArtProps = {
  /** The immutable template version to draw. Only its approved regions are rendered. */
  version: TemplateVersion
  fills: Fills
  className?: string
  /** Accessible name for the interactive canvas. */
  label?: string
  /** When provided, regions become tappable, focusable buttons. */
  onRegionTap?: (region: RegionInfo, element: SVGPathElement) => void
}

export function MandalaArt({ version, fills, className, label, onRegionTap }: MandalaArtProps) {
  const outline = useOutline(version)
  const interactive = Boolean(onRegionTap)
  const fine = version.line === 'fine'
  const lineWidth = fine ? (interactive ? 3.5 : 6) : interactive ? 7 : 14

  const handleClick = (region: RegionInfo) => (e: MouseEvent<SVGPathElement>) => {
    onRegionTap?.(region, e.currentTarget)
  }

  const handleKey = (region: RegionInfo) => (e: KeyboardEvent<SVGPathElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRegionTap?.(region, e.currentTarget)
    }
  }

  return (
    <svg
      viewBox="-24 -24 1048 1048"
      className={cn('select-none', interactive && 'touch-manipulation', className)}
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? label : undefined}
      aria-hidden={interactive ? undefined : true}
      focusable="false"
      data-line={fine ? 'fine' : undefined}
      aria-busy={outline ? undefined : true}
    >
      {!outline && (
        // The page's outline is on its way: a soft blank page holds its place.
        <circle cx="500" cy="500" r="470" fill="var(--canvas)" stroke="var(--border)" strokeWidth={6} />
      )}
      {outline?.regions.map(({ d }, i) => {
        const region = version.regions[i]
        const fill = fills[region.id]
        return (
          <path
            key={region.id}
            d={d}
            fill={fill ? colorVar(fill) : 'var(--canvas)'}
            stroke="var(--ink)"
            strokeWidth={lineWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            {...(interactive && {
              className: 'mandala-region',
              role: 'button',
              tabIndex: 0,
              'aria-label': fill ? `${region.label}, ${colorLabel(fill)}` : region.label,
              onClick: handleClick(region),
              onKeyDown: handleKey(region),
            })}
          />
        )
      })}
      {outline?.details.map((detail, i) => (
        <path
          key={i}
          d={detail.d}
          fill={detail.kind === 'dot' ? 'var(--ink)' : 'none'}
          fillRule={fine ? 'evenodd' : undefined}
          stroke={detail.kind === 'dot' ? 'none' : 'var(--ink)'}
          strokeWidth={lineWidth}
          strokeLinecap="round"
          pointerEvents="none"
        />
      ))}
    </svg>
  )
}
