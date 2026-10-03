'use client'

import { useState, type ReactNode } from 'react'
import { Check, House, Redo2, RotateCcwSquare, Undo2 } from 'lucide-react'
import { ColorPalette } from '@/components/coloring/color-palette'
import { TonalPalette } from '@/components/coloring/tonal-palette'
import { ClearPreview, CrossCheckDialog, DoneDialog } from '@/components/coloring/kid-dialogs'
import { PACK_BY_ID, packHref } from '@/lib/packs'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { ToolButton, ToolLink } from '@/components/coloring/tool-button'
import { AskGrownUp } from '@/components/kid/ask-grown-up'
import { useColoring } from '@/hooks/use-coloring'
import { EMPTY_FILLS, type Fills } from '@/lib/artwork/library'
import { settingsStore } from '@/lib/device-stores'
import { useEntitlements } from '@/lib/entitlements'
import { useHydrated, useLocalStore } from '@/lib/local-store'
import type { Mandala, RegionInfo } from '@/lib/mandalas'
import { DEFAULT_COLOR, DEFAULT_GROWN_UP_COLOR, ERASER, colorLabel, type Tool } from '@/lib/palette'

const GARDEN_HREF = '/garden'

const POP_FRAMES: Keyframe[] = [
  { transform: 'scale(1)' },
  { transform: 'scale(1.06)' },
  { transform: 'scale(1)' },
]

type ColoringScreenProps = {
  mandala: Mandala
  /** Set when the page was opened from My garden: the visit starts with that picture's colors. */
  gardenArtworkId?: string | null
  /** What a locked page shows. Children get "Ask a grown-up"; only the parent route passes something else. */
  lockedView?: ReactNode
}

export function ColoringScreen({ mandala, gardenArtworkId = null, lockedView }: ColoringScreenProps) {
  const hydrated = useHydrated()
  const entitlements = useEntitlements()
  const settings = useLocalStore(settingsStore)
  const coloring = useColoring(mandala, gardenArtworkId)
  const fromGarden = gardenArtworkId !== null
  const grownUps = PACK_BY_ID[mandala.pack].audience === 'grown-ups'
  const [tool, setTool] = useState<Tool>(grownUps ? DEFAULT_GROWN_UP_COLOR : DEFAULT_COLOR)
  const [clearOpen, setClearOpen] = useState(false)
  const [done, setDone] = useState<{ open: boolean; fills: Fills; updated: boolean }>({
    open: false,
    fills: EMPTY_FILLS,
    updated: false,
  })
  const [undoHint, setUndoHint] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  if (!hydrated || (mandala.tier !== 'free' && !entitlements.ready)) {
    return <main className="min-h-dvh bg-background" aria-busy="true" />
  }

  if (!entitlements.isUnlocked(mandala)) {
    return lockedView ?? <AskGrownUp mandala={mandala} />
  }

  const erasing = tool === ERASER

  const handleRegionTap = (region: RegionInfo, element: SVGPathElement) => {
    const changed = erasing ? coloring.erase(region.id) : coloring.fill(region.id, tool)
    if (!changed) return
    setUndoHint(false)
    setAnnouncement(erasing ? `${region.label}变回白色了` : `${region.label}涂成了${colorLabel(tool)}`)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (settings.motion && !reduceMotion) {
      element.animate(POP_FRAMES, { duration: 260, easing: 'ease-out' })
    }
    if (settings.haptics) {
      navigator.vibrate?.(12)
    }
  }

  const handleClear = () => {
    if (!coloring.clear()) return
    setUndoHint(true)
    setAnnouncement('重新开始。点“撤销”可以把颜色找回来。')
  }

  const handleUndo = () => {
    const undone = coloring.undo()
    setUndoHint(false)
    if (undone === 'clear') setAnnouncement('颜色都回来啦。')
    else if (undone === 'erase') setAnnouncement('颜色回来啦。')
    else if (undone === 'fill') setAnnouncement('已撤销。')
  }

  const handleRedo = () => {
    const redone = coloring.redo()
    setUndoHint(false)
    if (redone === 'clear') setAnnouncement('花朵又变白了。')
    else if (redone) setAnnouncement('已重做。')
  }

  const handleDone = () => {
    const updating = coloring.editingGardenPicture
    if (!coloring.save()) return
    setDone({ open: true, fills: coloring.fills, updated: updating })
  }

  return (
    <main className="flex h-dvh flex-col gap-4 overflow-hidden p-4 md:gap-6 md:p-6 landscape:flex-row">
      <h1 className="sr-only">{`正在涂「${mandala.name}」`}</h1>

      <nav
        aria-label="工具"
        className="flex items-center justify-between gap-4 landscape:order-3 landscape:flex-col"
      >
        <div className="flex items-center gap-4 landscape:flex-col">
          <ToolLink
            href={fromGarden ? GARDEN_HREF : packHref(mandala.pack)}
            label={fromGarden ? '回到我的花园' : `回到「${PACK_BY_ID[mandala.pack].name}」`}
            icon={<House strokeWidth={2.5} />}
          />
          <ToolButton
            label="重新开始"
            icon={<RotateCcwSquare strokeWidth={2.5} />}
            onClick={() => setClearOpen(true)}
            disabled={!coloring.hasColor}
          />
        </div>
        <div
          role="group"
          aria-label="撤销和重做"
          className="flex items-center gap-2 rounded-full bg-secondary p-2 landscape:flex-col"
        >
          <ToolButton
            label="撤销"
            icon={<Undo2 strokeWidth={2.75} />}
            variant="inset"
            onClick={handleUndo}
            disabled={!coloring.canUndo}
            className={undoHint ? 'attention' : undefined}
          />
          <ToolButton
            label="重做"
            icon={<Redo2 strokeWidth={2.75} />}
            variant="inset"
            onClick={handleRedo}
            disabled={!coloring.canRedo}
          />
        </div>
        <ToolButton
          label="我涂好了"
          icon={<Check strokeWidth={3.25} />}
          variant="primary"
          onClick={handleDone}
          disabled={!coloring.hasColor}
        />
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center landscape:order-2">
        <MandalaArt
          version={coloring.version}
          fills={coloring.fills}
          label={`「${mandala.name}」花朵。${erasing ? '点一块，让它变回白色。' : '点一块，给它涂上颜色。'}`}
          onRegionTap={handleRegionTap}
          className="size-full max-h-full max-w-full"
        />
      </div>

      {grownUps ? (
        <TonalPalette value={tool} onChange={setTool} className="self-center landscape:order-1" />
      ) : (
        <ColorPalette
          value={tool}
          onChange={setTool}
          className="self-center landscape:order-1 landscape:flex-col"
        />
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <CrossCheckDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="要重新开始吗？"
        description="这朵花上的颜色都会消失。你可以点“撤销”把它们找回来。"
        preview={<ClearPreview version={coloring.version} fills={coloring.fills} />}
        cancelLabel="不，留着我的颜色"
        confirmLabel="好，重新开始"
        onConfirm={handleClear}
      />
      <DoneDialog
        moreHref={fromGarden ? GARDEN_HREF : packHref(mandala.pack)}
        savedNote={
          grownUps
            ? '这一页已保存。可以换一页，也可以继续涂。'
            : done.updated
              ? '花园里的图画已更新。可以换一幅，也可以继续涂。'
              : undefined
        }
        open={done.open}
        onOpenChange={(open) => setDone((d) => ({ ...d, open }))}
        version={coloring.version}
        fills={done.fills}
        onFinish={coloring.finish}
      />
    </main>
  )
}
