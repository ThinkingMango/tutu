import { MandalaArt } from '@/components/coloring/mandala-art'
import { SaveStateBadge } from '@/components/parent/pictures/save-state-badge'
import type { ExportPicture } from '@/components/parent/pictures/types'

type PicturePickerProps = {
  pictures: readonly ExportPicture[]
  isSelected: (id: string) => boolean
  onToggle: (id: string, selected: boolean) => void
}

export function PicturePicker({ pictures, isSelected, onToggle }: PicturePickerProps) {
  return (
    <ul aria-label="Pictures to print or save" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {pictures.map((picture) => (
        <li key={picture.artwork.id}>
          <label className="flex h-full cursor-pointer flex-col gap-3 rounded-3xl border-2 bg-card p-3 transition-colors has-checked:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-background">
              <MandalaArt version={picture.version} fills={picture.artwork.fills} className="size-full" />
              <input
                type="checkbox"
                checked={isSelected(picture.artwork.id)}
                onChange={(e) => onToggle(picture.artwork.id, e.target.checked)}
                className="absolute top-2 left-2 size-6 cursor-pointer accent-primary focus-visible:outline-none"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 px-1">
              <span className="truncate font-bold">{picture.name}</span>
              <span className="text-sm text-muted-foreground">{picture.dateLabel}</span>
              <SaveStateBadge state={picture.saveState} />
            </div>
          </label>
        </li>
      ))}
    </ul>
  )
}
