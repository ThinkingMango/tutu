'use client'

import { useRef, type KeyboardEvent } from 'react'
import type { Tool } from '@/lib/palette'

const NEXT_KEYS = ['ArrowRight', 'ArrowDown']
const PREV_KEYS = ['ArrowLeft', 'ArrowUp']

/**
 * Radio-group behavior shared by both palettes: one tab stop on the chosen tool, and arrow keys,
 * Home and End that move through `tools` in order and choose as they go.
 */
export function usePaletteRadios(tools: readonly Tool[], value: Tool, onChange: (tool: Tool) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (index: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    let next = index
    if (NEXT_KEYS.includes(e.key)) next = (index + 1) % tools.length
    else if (PREV_KEYS.includes(e.key)) next = (index - 1 + tools.length) % tools.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tools.length - 1
    else return
    e.preventDefault()
    onChange(tools[next])
    refs.current[next]?.focus()
  }

  return (tool: Tool, label: string) => {
    const index = tools.indexOf(tool)
    const selected = tool === value
    return {
      selected,
      props: {
        ref: (el: HTMLButtonElement | null) => {
          refs.current[index] = el
        },
        type: 'button' as const,
        role: 'radio',
        'aria-checked': selected,
        'aria-label': label,
        title: label,
        tabIndex: selected ? 0 : -1,
        onClick: () => onChange(tool),
        onKeyDown: handleKeyDown(index),
      },
    }
  }
}
