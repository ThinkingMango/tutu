'use client'

import type { CSSProperties } from 'react'
import { Check, Eraser } from 'lucide-react'
import { usePaletteRadios } from '@/components/coloring/use-palette-radios'
import { ERASER, GROWN_UP_FAMILIES, GROWN_UP_PALETTE, colorLabel, colorVar, type Tool } from '@/lib/palette'
import { cn } from '@/lib/utils'

type TonalPaletteProps = {
  value: Tool
  onChange: (tool: Tool) => void
  className?: string
}

const TOOLS: readonly Tool[] = [...GROWN_UP_PALETTE.map((c) => c.key), ERASER]

function chipClass(selected: boolean, className?: string) {
  return cn(
    'tactile flex size-10 shrink-0 items-center justify-center rounded-xl outline-none sm:size-14 sm:rounded-2xl',
    'focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary',
    selected && 'z-10 ring-3 ring-ink ring-offset-2 ring-offset-secondary',
    className,
  )
}

/**
 * The grown-up palette: six color families of four shades. In portrait each family is a column, pale
 * at the top; in landscape each family is a row, pale on the left. The chosen color is named above.
 */
export function TonalPalette({ value, onChange, className }: TonalPaletteProps) {
  const radio = usePaletteRadios(TOOLS, value, onChange)
  const eraser = radio(ERASER, '橡皮擦')

  return (
    <div
      role="radiogroup"
      aria-label="颜色和橡皮擦"
      className={cn('flex flex-col gap-2 rounded-[2rem] bg-secondary p-2 sm:gap-3 sm:p-4', className)}
    >
      <p
        aria-hidden="true"
        className="px-1 text-sm font-extrabold text-muted-foreground [@media(max-height:30rem)]:hidden"
      >
        {value === ERASER ? '橡皮擦' : colorLabel(value)}
      </p>

      <div className="flex items-center gap-2 sm:gap-3 landscape:flex-col">
        <div className="flex gap-2 landscape:flex-col">
          {GROWN_UP_FAMILIES.map((family) => (
            <div
              key={family.name}
              role="group"
              aria-label={family.name}
              className="flex flex-col gap-1 landscape:flex-row"
            >
              {family.colors.map((color) => {
                const { selected, props } = radio(color.key, color.label)
                return (
                  <button
                    key={color.key}
                    {...props}
                    style={
                      {
                        backgroundColor: colorVar(color.key),
                        '--tactile-edge': `color-mix(in oklch, ${colorVar(color.key)} 62%, var(--ink))`,
                      } as CSSProperties
                    }
                    className={chipClass(selected)}
                  >
                    {selected && (
                      <span className="flex size-6 items-center justify-center rounded-full bg-background sm:size-7">
                        <Check className="size-4 text-ink sm:size-5" strokeWidth={3.5} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <span aria-hidden="true" className="h-10 w-0.5 shrink-0 rounded-full bg-border landscape:h-0.5 landscape:w-10" />

        <button
          {...eraser.props}
          className={chipClass(
            eraser.selected,
            'border-2 border-dashed border-muted-foreground bg-background text-ink [--tactile-edge:var(--border)]',
          )}
        >
          <Eraser className="size-5 sm:size-7" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
