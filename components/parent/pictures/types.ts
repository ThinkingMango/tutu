import type { Artwork } from '@/lib/artwork/library'
import type { PictureSaveState } from '@/lib/cloud-sync/picture-state'
import type { TemplateVersion } from '@/lib/mandalas'

export type ExportPicture = Readonly<{
  artwork: Artwork
  version: TemplateVersion
  name: string
  dateLabel: string
  saveState: PictureSaveState
}>
