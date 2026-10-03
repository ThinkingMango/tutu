'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { AppWindowMac, CircleAlert, Share } from 'lucide-react'
import { useArtworkLibrary } from '@/hooks/use-artwork-library'

const noSubscribe = () => () => {}
const never = () => false
const nowhere = () => null

/** Where Safari deletes a site's saved data after 7 days without a visit, unless opened from the Home Screen or Dock. */
export type HomeScreenDevice = 'iphone' | 'ipad' | 'mac'

type DeviceInfo = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> & {
  /** Opened from the Home Screen or the Dock, where the 7-day rule doesn't apply. */
  installed: boolean
}

/**
 * Which device's tip to show, or null when none is needed. iPadOS Safari reports itself as a Mac,
 * so touch support tells them apart: a Mac reports no touch points. Chrome, Edge and Firefox on a
 * Mac also say "Safari" in their user agent, so they're ruled out by name.
 */
export function homeScreenDevice({ userAgent, platform, maxTouchPoints, installed }: DeviceInfo): HomeScreenDevice | null {
  if (installed) return null
  if (/iPhone|iPod/.test(userAgent)) return 'iphone'
  if (/iPad/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'ipad'
  const macSafari =
    /Macintosh/.test(userAgent) && /Safari\//.test(userAgent) && !/Chrome|Chromium|Edg|Firefox|OPR|Opera/.test(userAgent)
  return macSafari ? 'mac' : null
}

function currentDevice() {
  const nav = navigator as Navigator & { standalone?: boolean }
  const installed = nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
  return homeScreenDevice({ userAgent: nav.userAgent, platform: nav.platform, maxTouchPoints: nav.maxTouchPoints, installed })
}

const TIPS: Record<HomeScreenDevice, { title: string; steps: string; icon: typeof Share }> = {
  iphone: {
    title: '在这台 iPhone 上保护好花园',
    steps: '点击“分享”，再选择“添加到主屏幕”，之后从主屏幕打开小小曼陀罗。',
    icon: Share,
  },
  ipad: {
    title: '在这台 iPad 上保护好花园',
    steps: '点击“分享”，再选择“添加到主屏幕”，之后从主屏幕打开小小曼陀罗。',
    icon: Share,
  },
  mac: {
    title: '在这台 Mac 上保护好花园',
    steps: '在 Safari 中选择“文件”，再选择“添加到程序坞”（macOS Sonoma 或更高版本），之后从程序坞打开小小曼陀罗。',
    icon: AppWindowMac,
  },
}

/**
 * Asked from the parent area only: Firefox shows a permission prompt for this, which a child
 * shouldn't see. Chrome and Android grant it quietly, so the browser won't clear the garden to
 * free up space.
 */
function useRequestPersistentStorage() {
  useEffect(() => {
    const storage = navigator.storage
    if (!storage?.persist || !storage.persisted) return
    storage
      .persisted()
      .then((persisted) => (persisted ? true : storage.persist()))
      .catch(() => {})
  }, [])
}

export function DeviceStorageNotice() {
  const { library } = useArtworkLibrary()
  const saveFailed = useSyncExternalStore(library.subscribe, library.isStorageFull, never)
  const device = useSyncExternalStore(noSubscribe, currentDevice, nowhere)
  useRequestPersistentStorage()

  if (saveFailed) {
    return (
      <div role="alert" className="flex gap-3 rounded-2xl bg-destructive/10 p-4">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="font-bold text-destructive">{"涂色没有被保存"}</p>
          <p className="text-sm leading-relaxed text-foreground">
            {
              "这台设备上留给小小曼陀罗的空间已用完，新的涂色无法保存。请在下方清除已保存的涂色，或释放设备空间。"
            }
          </p>
        </div>
      </div>
    )
  }

  if (!device) return null
  const { title, steps, icon: Icon } = TIPS[device]

  return (
    <div className="flex gap-3 rounded-2xl bg-secondary p-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {`Safari 会清除 7 天未使用的网站所保存的图画。${steps}在 Safari 中涂的图画不会自动转移，请开启云端保存来保留它们。`}
        </p>
      </div>
    </div>
  )
}
