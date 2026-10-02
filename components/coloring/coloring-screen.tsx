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
    setAnnouncement(erasing ? `${region.label} is white again` : `${region.label} is now ${colorLabel(tool)}`)

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
    setAnnouncement('Starting over. Tap undo to bring the colors back.')
  }

  const handleUndo = () => {
    const undone = coloring.undo()
    setUndoHint(false)
    if (undone === 'clear') setAnnouncement('Your colors are back.')
    else if (undone === 'erase') setAnnouncement('The color is back.')
    else if (undone === 'fill') setAnnouncement('Undone.')
  }

  const handleRedo = () => {
    const redone = coloring.redo()
    setUndoHint(false)
    if (redone === 'clear') setAnnouncement('The flower is white again.')
    else if (redone) setAnnouncement('Redone.')
  }

  const handleDone = () => {
    const updating = coloring.editingGardenPicture
    if (!coloring.save()) return
    setDone({ open: true, fills: coloring.fills, updated: updating })
  }

  return (
    <main className="flex h-dvh flex-col gap-4 overflow-hidden p-4 md:gap-6 md:p-6 landscape:flex-row">
      <h1 className="sr-only">{`Coloring ${mandala.name}`}</h1>

      <nav
        aria-label="Tools"
        className="flex items-center justify-between gap-4 landscape:order-3 landscape:flex-col"
      >
        <div className="flex items-center gap-4 landscape:flex-col">
          <ToolLink
            href={fromGarden ? GARDEN_HREF : packHref(mandala.pack)}
            label={fromGarden ? 'Back to My garden' : `Back to ${PACK_BY_ID[mandala.pack].name}`}
            icon={<House strokeWidth={2.5} />}
          />
          <ToolButton
            label="Start over"
            icon={<RotateCcwSquare strokeWidth={2.5} />}
            onClick={() => setClearOpen(true)}
            disabled={!coloring.hasColor}
          />
        </div>
        <div
          role="group"
          aria-label="Undo and redo"
          className="flex items-center gap-2 rounded-full bg-secondary p-2 landscape:flex-col"
        >
          <ToolButton
            label="Undo"
            icon={<Undo2 strokeWidth={2.75} />}
            variant="inset"
            onClick={handleUndo}
            disabled={!coloring.canUndo}
            className={undoHint ? 'attention' : undefined}
          />
          <ToolButton
            label="Redo"
            icon={<Redo2 strokeWidth={2.75} />}
            variant="inset"
            onClick={handleRedo}
            disabled={!coloring.canRedo}
          />
        </div>
        <ToolButton
          label="I'm done"
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
          label={`${mandala.name} flower. ${erasing ? 'Tap a part to make it white again.' : 'Tap a part to color it.'}`}
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
        title="Start over?"
        description="All the colors on this flower will go away. You can bring them back with undo."
        preview={<ClearPreview version={coloring.version} fills={coloring.fills} />}
        cancelLabel="No, keep my colors"
        confirmLabel="Yes, start over"
        onConfirm={handleClear}
      />
      <DoneDialog
        moreHref={fromGarden ? GARDEN_HREF : packHref(mandala.pack)}
        savedNote={
          grownUps
            ? 'Your page is saved. Pick another page or keep coloring.'
            : done.updated
              ? 'Your garden picture is updated. Pick another picture or keep coloring.'
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
