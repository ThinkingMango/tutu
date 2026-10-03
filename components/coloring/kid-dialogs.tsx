'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, Check, LayoutGrid, Paintbrush, Sparkles, Trash2, X } from 'lucide-react'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { EMPTY_FILLS, type Fills } from '@/lib/artwork/library'
import type { TemplateVersion } from '@/lib/mandalas'
import { cn } from '@/lib/utils'

const bigButton =
  'tactile flex h-18 flex-1 items-center justify-center gap-3 rounded-full px-6 text-xl font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4 [&_svg]:size-7'

const roundChoice =
  'tactile flex size-24 items-center justify-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4 [&_svg]:size-12'

const dialogShell =
  'flex flex-col items-center gap-6 rounded-[2.5rem] p-8 text-center sm:max-w-lg ring-0 shadow-2xl'

type CrossCheckDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Read to screen readers; the preview shows sighted pre-readers what will happen. */
  description: string
  preview: ReactNode
  cancelLabel: string
  confirmLabel: string
  onConfirm: () => void
}

/** A picture-first confirmation for pre-readers: a big cross to back out, a big check to go ahead. */
export function CrossCheckDialog({
  open,
  onOpenChange,
  title,
  description,
  preview,
  cancelLabel,
  confirmLabel,
  onConfirm,
}: CrossCheckDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={dialogShell}>
        <DialogTitle className="text-3xl font-black text-balance">{title}</DialogTitle>
        {preview}
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <div className="flex items-center justify-center gap-10">
          <button
            type="button"
            aria-label={cancelLabel}
            title={cancelLabel}
            onClick={() => onOpenChange(false)}
            className={cn(roundChoice, 'bg-secondary text-foreground [--tactile-edge:var(--border)]')}
          >
            <X aria-hidden="true" strokeWidth={3.5} />
          </button>
          <button
            type="button"
            aria-label={confirmLabel}
            title={confirmLabel}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            className={cn(
              roundChoice,
              'bg-swatch-green text-ink [--tactile-edge:color-mix(in_oklch,var(--swatch-green)_55%,var(--ink))]',
            )}
          >
            <Check aria-hidden="true" strokeWidth={3.5} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ClearPreview({ version, fills }: { version: TemplateVersion; fills: Fills }) {
  return (
    <div
      role="img"
      aria-label="涂好的花朵会全部变成白色"
      className="flex items-center justify-center gap-3 md:gap-5"
    >
      <MandalaArt version={version} fills={fills} className="size-32 md:size-40" />
      <ArrowRight className="size-10 shrink-0 text-muted-foreground" strokeWidth={3} aria-hidden="true" />
      <MandalaArt version={version} fills={EMPTY_FILLS} className="size-32 md:size-40" />
    </div>
  )
}

export function RemovePreview({ version, fills }: { version: TemplateVersion; fills: Fills }) {
  return (
    <div role="img" aria-label="这朵花会离开你的花园" className="relative size-40">
      <MandalaArt version={version} fills={fills} className="size-full" />
      <span className="absolute -right-2 -bottom-2 flex size-14 items-center justify-center rounded-full bg-destructive text-primary-foreground">
        <Trash2 className="size-7" strokeWidth={2.75} aria-hidden="true" />
      </span>
    </div>
  )
}

type DoneDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: TemplateVersion
  fills: Fills
  /** Called before leaving so the next visit to this flower starts a new artwork. */
  onFinish: () => void
  /** Where "More pictures" goes: the pack this picture came from. */
  moreHref: string
  /** Read to screen readers when the dialog opens. */
  savedNote?: string
}

export function DoneDialog({
  open,
  onOpenChange,
  version,
  fills,
  onFinish,
  moreHref,
  savedNote = '你的图画已经保存在花园里。可以换一幅，也可以继续涂。',
}: DoneDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={dialogShell}>
        <div className="relative flex size-56 items-center justify-center">
          <MandalaArt version={version} fills={fills} className="size-full" />
          <Sparkles
            className="animate-twinkle absolute -top-2 -left-3 size-10 text-swatch-yellow"
            fill="currentColor"
            aria-hidden="true"
          />
          <Sparkles
            className="animate-twinkle absolute -right-4 top-10 size-8 text-swatch-orange [animation-delay:400ms]"
            fill="currentColor"
            aria-hidden="true"
          />
          <Sparkles
            className="animate-twinkle absolute -bottom-2 left-6 size-7 text-swatch-blue [animation-delay:800ms]"
            fill="currentColor"
            aria-hidden="true"
          />
        </div>
        <DialogTitle className="text-4xl font-black text-balance">真漂亮！</DialogTitle>
        <DialogDescription className="sr-only">{savedNote}</DialogDescription>
        <div className="flex w-full flex-col gap-4 sm:flex-row">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(bigButton, 'bg-secondary text-foreground [--tactile-edge:var(--border)]')}
          >
            <Paintbrush aria-hidden="true" strokeWidth={2.5} />
            继续涂
          </button>
          <Link
            href={moreHref}
            onClick={onFinish}
            className={cn(
              bigButton,
              'bg-primary text-primary-foreground [--tactile-edge:color-mix(in_oklch,var(--primary)_60%,var(--ink))]',
            )}
          >
            <LayoutGrid aria-hidden="true" strokeWidth={2.5} />
            更多图画
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
