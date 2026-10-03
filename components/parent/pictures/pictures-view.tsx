'use client'

import { useState } from 'react'
import { FileDown, Printer } from 'lucide-react'
import { PicturePicker } from '@/components/parent/pictures/picture-picker'
import { PrintSheet } from '@/components/parent/pictures/print-sheet'
import { SaveStateSummary } from '@/components/parent/pictures/save-state-summary'
import type { ExportPicture } from '@/components/parent/pictures/types'
import { Button } from '@/components/ui/button'
import { useArtworkLibrary } from '@/hooks/use-artwork-library'
import { renderArtworkSvg } from '@/lib/cloud-sync/artwork-svg'
import { useCloudSync } from '@/lib/cloud-sync/client'
import { pictureSaveState } from '@/lib/cloud-sync/picture-state'
import { saveFile, svgToPng } from '@/lib/export/rasterize'
import { useHydrated } from '@/lib/local-store'
import { getMandala } from '@/lib/mandalas'
import { loadOutline } from '@/lib/templates/outlines'

const longDate = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' })

type PdfStatus =
  | { kind: 'idle' }
  | { kind: 'working'; done: number; total: number }
  | { kind: 'saved'; count: number }
  | { kind: 'error' }

export function PicturesView() {
  const hydrated = useHydrated()
  const { library, state } = useArtworkLibrary()
  const { snapshot } = useCloudSync()
  const [deselected, setDeselected] = useState<ReadonlySet<string>>(() => new Set())
  const [pdf, setPdf] = useState<PdfStatus>({ kind: 'idle' })
  const [printing, setPrinting] = useState(false)
  const [printFailed, setPrintFailed] = useState(false)

  const pictures: ExportPicture[] = state.gallery.flatMap((artwork) => {
    const version = library.templates.version(artwork.templateId, artwork.templateVersion)
    if (!version) return []
    return [
      {
        artwork,
        version,
        name: getMandala(artwork.templateId)?.name ?? '花园图画',
        dateLabel: longDate.format(artwork.updatedAt || artwork.createdAt),
        saveState: pictureSaveState(snapshot, artwork.id),
      },
    ]
  })
  const selected = pictures.filter((picture) => !deselected.has(picture.artwork.id))
  const working = pdf.kind === 'working'

  const toggle = (id: string, isOn: boolean) =>
    setDeselected((current) => {
      const next = new Set(current)
      if (isOn) next.delete(id)
      else next.add(id)
      return next
    })

  const downloadPdf = async () => {
    const chosen = selected
    setPdf({ kind: 'working', done: 0, total: chosen.length })
    try {
      const { buildPicturesPdf, picturesPdfFileName } = await import('@/lib/export/pictures-pdf')
      const pages = []
      for (const picture of chosen) {
        const outline = await loadOutline(picture.version)
        const png = await svgToPng(renderArtworkSvg(picture.version, outline, picture.artwork.fills))
        pages.push({ name: picture.name, dateLabel: picture.dateLabel, png })
        setPdf({ kind: 'working', done: pages.length, total: chosen.length })
      }
      saveFile(await buildPicturesPdf(pages), picturesPdfFileName(), 'application/pdf')
      setPdf({ kind: 'saved', count: chosen.length })
    } catch (error) {
      console.error('Making the pictures PDF failed', error)
      setPdf({ kind: 'error' })
    }
  }

  /** Every chosen picture's outline is fetched first, so no sheet prints blank. */
  const print = async () => {
    setPrinting(true)
    setPrintFailed(false)
    try {
      await Promise.all(selected.map((picture) => loadOutline(picture.version)))
      // Let the print sheet draw the outlines that just arrived before the browser takes its copy.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      window.print()
    } catch (error) {
      console.error('Getting pictures ready to print failed', error)
      setPrintFailed(true)
    } finally {
      setPrinting(false)
    }
  }

  if (!hydrated) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8 md:px-8 md:py-10">
        <h1 className="text-3xl font-black">图画</h1>
        <p className="leading-relaxed text-muted-foreground">正在加载这台设备上的图画…</p>
      </main>
    )
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8 md:px-8 md:py-10 print:hidden">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-black">图画</h1>
          <p className="max-w-2xl leading-relaxed text-muted-foreground text-pretty">
            打印花园里完成的图画，或保存为 PDF。只有你能在家长区域进行这些操作，孩子不会看到这些选项。
          </p>
        </header>

        <SaveStateSummary onDevice={pictures.length} />

        {pictures.length === 0 ? (
          <section className="flex flex-col gap-2 rounded-3xl border border-dashed bg-card p-6">
            <h2 className="text-lg font-extrabold">还没有完成的图画</h2>
            <p className="leading-relaxed text-muted-foreground">
              {'孩子点击“我画好啦”后，图画就会出现在这里，可以直接打印。'}
            </p>
          </section>
        ) : (
          <section aria-labelledby="choose-heading" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="choose-heading" className="text-lg font-extrabold">
                {`选择图画 · 已选 ${selected.length} / ${pictures.length}`}
              </h2>
              <Button
                variant="ghost"
                onClick={() =>
                  setDeselected(
                    selected.length === pictures.length ? new Set(pictures.map((p) => p.artwork.id)) : new Set(),
                  )
                }
                className="h-10 rounded-full px-4 font-bold"
              >
                {selected.length === pictures.length ? '全部取消' : '全选'}
              </Button>
            </div>

            <PicturePicker
              pictures={pictures}
              isSelected={(id) => !deselected.has(id)}
              onToggle={toggle}
            />

            <div className="sticky bottom-4 z-10 flex flex-col gap-2 rounded-3xl border bg-card p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:pl-5">
              <p role="status" aria-live="polite" className="text-sm font-semibold text-muted-foreground">
                {printFailed
                  ? '图画未能准备好打印。请检查网络连接后再试。'
                  : pdf.kind === 'working'
                  ? `正在生成 PDF… ${pdf.done} / ${pdf.total}`
                  : pdf.kind === 'saved'
                    ? `PDF 已保存，共 ${pdf.count} 张图画。`
                    : pdf.kind === 'error'
                      ? 'PDF 生成失败，请再试一次。'
                      : selected.length === 0
                        ? '请至少选择一张图画。'
                        : `每页一张图画 · 共 ${selected.length} 页`}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => void print()}
                  disabled={selected.length === 0 || working || printing}
                  className="h-11 flex-1 rounded-full px-5 font-bold sm:flex-none"
                >
                  <Printer data-icon="inline-start" />
                  打印
                </Button>
                <Button
                  onClick={() => void downloadPdf()}
                  disabled={selected.length === 0 || working}
                  className="h-11 flex-1 rounded-full px-5 font-bold sm:flex-none"
                >
                  <FileDown data-icon="inline-start" />
                  {working ? '正在生成 PDF…' : '下载 PDF'}
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>
      <PrintSheet pictures={selected} />
    </>
  )
}
