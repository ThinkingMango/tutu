import { MandalaArt } from '@/components/coloring/mandala-art'
import type { ExportPicture } from '@/components/parent/pictures/types'

/** Only exists on paper: one picture per sheet, with its name and the day it was colored. */
export function PrintSheet({ pictures }: { pictures: readonly ExportPicture[] }) {
  return (
    <div className="hidden text-foreground print:block">
      {pictures.length === 0 ? (
        <p className="text-lg font-bold">No pictures chosen. Pick some on the Pictures page, then print again.</p>
      ) : (
        pictures.map((picture) => (
          <section
            key={picture.artwork.id}
            className="flex flex-col items-center gap-6 break-inside-avoid [&:not(:last-child)]:break-after-page"
          >
            <h2 className="text-3xl font-black">{picture.name}</h2>
            <MandalaArt
              version={picture.version}
              fills={picture.artwork.fills}
              className="aspect-square w-full max-w-[17cm]"
            />
            <p className="text-base text-muted-foreground">{`Colored on ${picture.dateLabel}`}</p>
          </section>
        ))
      )}
    </div>
  )
}
