'use client'

import type { CSSProperties } from 'react'
import { Check, Eraser } from 'lucide-react'
import { usePaletteRadios } from '@/components/coloring/use-palette-radios'
import { ERASER, PALETTE, colorVar, type Tool } from '@/lib/palette'
import { cn } from '@/lib/utils'

type ColorPaletteProps = {
  value: Tool
  onChange: (tool: Tool) => void
  className?: string
}

const TOOLS: readonly Tool[] = [...PALETTE.map((c) => c.key), ERASER]

function swatchClass(selected: boolean, className?: string) {
  return cn(
    'tactile flex size-11 shrink-0 items-center justify-center rounded-full outline-none sm:size-16',
    'focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary sm:focus-visible:ring-offset-4',
    selected && 'z-10 scale-110 ring-4 ring-ink ring-offset-2 ring-offset-secondary sm:ring-offset-4',
    className,
  )
}

export function ColorPalette({ value, onChange, className }: ColorPaletteProps) {
  const radio = usePaletteRadios(TOOLS, value, onChange)
  const eraser = radio(ERASER, '橡皮擦')

  return (
    <div
      role="radiogroup"
      aria-label="颜色和橡皮擦"
      className={cn(
        'flex items-center justify-center gap-2 rounded-[2.5rem] bg-secondary p-2 sm:gap-3 sm:p-4',
        className,
      )}
    >
      <div className="grid grid-flow-col grid-rows-2 gap-1.5 sm:gap-3 landscape:grid-flow-row landscape:grid-cols-2 landscape:grid-rows-none">
        {PALETTE.map((color) => {
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
              className={swatchClass(selected)}
            >
              {selected && (
                <span className="flex size-8 items-center justify-center rounded-full bg-background sm:size-9">
                  <Check className="size-5 text-ink sm:size-6" strokeWidth={3.5} aria-hidden="true" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <span aria-hidden="true" className="h-10 w-0.5 shrink-0 rounded-full bg-border landscape:h-0.5 landscape:w-10" />

      <button
        {...eraser.props}
        className={swatchClass(
          eraser.selected,
          'border-2 border-dashed border-muted-foreground bg-background text-ink [--tactile-edge:var(--border)]',
        )}
      >
        <Eraser className="size-6 sm:size-8" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  )
}
