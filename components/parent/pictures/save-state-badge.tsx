import { Cloud, CloudUpload, LoaderCircle, MonitorSmartphone } from 'lucide-react'
import { SAVE_STATE_LABEL, type PictureSaveState } from '@/lib/cloud-sync/picture-state'
import { cn } from '@/lib/utils'

const ICONS = {
  'device-only': MonitorSmartphone,
  'removed-elsewhere': MonitorSmartphone,
  'in-cloud': Cloud,
  waiting: CloudUpload,
  checking: LoaderCircle,
} as const

export function SaveStateBadge({ state }: { state: PictureSaveState }) {
  const Icon = ICONS[state]
  const { short, detail } = SAVE_STATE_LABEL[state]
  return (
    <span
      title={detail}
      data-state={state}
      className={cn(
        'inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-bold',
        state === 'in-cloud' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('size-3.5 shrink-0', state === 'checking' && 'animate-spin motion-reduce:animate-none')}
      />
      {short}
    </span>
  )
}
