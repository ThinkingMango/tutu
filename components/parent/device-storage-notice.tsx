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
    title: 'Keep the garden safe on this iPhone',
    steps: 'Tap Share, then Add to Home Screen, and open Little Mandala from there.',
    icon: Share,
  },
  ipad: {
    title: 'Keep the garden safe on this iPad',
    steps: 'Tap Share, then Add to Home Screen, and open Little Mandala from there.',
    icon: Share,
  },
  mac: {
    title: 'Keep the garden safe on this Mac',
    steps: 'In Safari, choose File, then Add to Dock (macOS Sonoma or later), and open Little Mandala from the Dock.',
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
          <p className="font-bold text-destructive">{"Coloring isn't being saved"}</p>
          <p className="text-sm leading-relaxed text-foreground">
            {
              "This device has run out of space for Little Mandala, so new taps don't stick. Clear saved coloring below, or free up space on the device."
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
          {`Safari clears saved pictures from sites that go unused for 7 days. ${steps} Pictures colored in Safari don't move across, so turn on cloud saving to keep them.`}
        </p>
      </div>
    </div>
  )
}
