import { House, Lock } from 'lucide-react'
import { ToolLink } from '@/components/coloring/tool-button'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { EMPTY_FILLS } from '@/lib/artwork/library'
import { latestVersion, type Mandala } from '@/lib/mandalas'
import { packThemeStyle } from '@/lib/pack-theme'
import { PACK_BY_ID, packHref } from '@/lib/packs'

/** A locked page on a child's screen. It only points back to the pack, never to pricing. */
export function AskGrownUp({ mandala }: { mandala: Mandala }) {
  const pack = PACK_BY_ID[mandala.pack]

  return (
    <main
      style={packThemeStyle(pack.id)}
      className="pack-theme flex min-h-dvh flex-col items-center justify-center gap-8 bg-(--pack-tint) p-8 text-center text-ink"
    >
      <div className="relative size-64 rounded-[2.5rem] border-4 border-(--pack) bg-card p-6">
        <MandalaArt version={latestVersion(mandala)} fills={EMPTY_FILLS} className="size-full opacity-40" />
        <span className="absolute inset-0 m-auto flex size-24 items-center justify-center rounded-full border-4 border-background bg-ink text-background">
          <Lock className="size-12" strokeWidth={2.5} aria-hidden="true" />
        </span>
      </div>
      <h1 className="text-4xl font-black text-balance">Ask a grown-up</h1>
      <p className="max-w-sm text-lg font-bold leading-relaxed text-ink/75 text-pretty">
        This picture is still sleeping. A grown-up can wake it up.
      </p>
      <ToolLink
        href={packHref(mandala.pack)}
        label={`Back to ${pack.name}`}
        icon={<House strokeWidth={2.5} />}
        variant="primary"
      />
    </main>
  )
}
