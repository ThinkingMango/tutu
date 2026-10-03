import { Lock, Tag } from 'lucide-react'
import { ToolLink } from '@/components/coloring/tool-button'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { EMPTY_FILLS } from '@/lib/artwork/library'
import { latestVersion, type Mandala } from '@/lib/mandalas'
import { PACK_BY_ID } from '@/lib/packs'

/** A locked grown-up page. Only shown behind the parent gate, so it may point to pricing. */
export function GrownUpLocked({ mandala }: { mandala: Mandala }) {
  const pack = PACK_BY_ID[mandala.pack]

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="relative size-64">
        <MandalaArt version={latestVersion(mandala)} fills={EMPTY_FILLS} className="size-full opacity-40" />
        <span className="absolute inset-0 m-auto flex size-24 items-center justify-center rounded-full bg-ink text-background">
          <Lock className="size-12" strokeWidth={2.5} aria-hidden="true" />
        </span>
      </div>
      <h1 className="text-4xl font-black text-balance">这一页已锁定</h1>
      <p className="max-w-sm text-lg leading-relaxed text-muted-foreground text-pretty">
        {`在价格页面获取${pack.name}后即可涂色。`}
      </p>
      <ToolLink href="/parent/billing" label="查看价格" icon={<Tag strokeWidth={2.5} />} variant="primary" />
    </main>
  )
}
