import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeviceSettingsCard } from '@/components/parent/device-settings-card'
import { homeScreenDevice } from '@/components/parent/device-storage-notice'

// User agents as each browser really sends them. iPadOS Safari sends the Mac one.
const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
const EDGE_MAC = `${CHROME_MAC} Edg/140.0.0.0`
const FIREFOX_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0'
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const OLD_IPAD = 'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1'
const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const device = (userAgent: string, platform: string, maxTouchPoints: number, installed = false) =>
  homeScreenDevice({ userAgent, platform, maxTouchPoints, installed })

describe('which device the "keep the garden safe" tip names', () => {
  it('names the iPhone, iPad or Mac it is shown on', () => {
    expect(device(SAFARI_IPHONE, 'iPhone', 5)).toBe('iphone')
    expect(device(SAFARI_MAC, 'MacIntel', 5)).toBe('ipad')
    expect(device(OLD_IPAD, 'iPad', 5)).toBe('ipad')
    expect(device(SAFARI_MAC, 'MacIntel', 0)).toBe('mac')
  })

  it('is not shown in browsers that don’t clear pictures after 7 days', () => {
    expect(device(CHROME_MAC, 'MacIntel', 0)).toBeNull()
    expect(device(EDGE_MAC, 'MacIntel', 0)).toBeNull()
    expect(device(FIREFOX_MAC, 'MacIntel', 0)).toBeNull()
    expect(device(CHROME_WINDOWS, 'Win32', 0)).toBeNull()
    expect(device(CHROME_ANDROID, 'Linux armv81', 5)).toBeNull()
  })

  it('is not shown once Little Mandala is opened from the Home Screen or the Dock', () => {
    expect(device(SAFARI_IPHONE, 'iPhone', 5, true)).toBeNull()
    expect(device(SAFARI_MAC, 'MacIntel', 5, true)).toBeNull()
    expect(device(SAFARI_MAC, 'MacIntel', 0, true)).toBeNull()
  })
})

describe('the "On this device" card', () => {
  afterEach(() => vi.restoreAllMocks())

  const pretendToBe = (userAgent: string, maxTouchPoints: number) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true })
  }

  it('on a Mac in Safari, says "Mac" and explains Add to Dock, never "tablet" or "iPad"', () => {
    pretendToBe(SAFARI_MAC, 0)
    const { container } = render(<DeviceSettingsCard />)
    expect(screen.getByText('Keep the garden safe on this Mac')).toBeInTheDocument()
    expect(screen.getByText(/choose File, then Add to Dock/)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/tablet|iPad/i)
  })

  it('on a Mac in Chrome, shows no tip and doesn’t mention a tablet', () => {
    pretendToBe(CHROME_MAC, 0)
    const { container } = render(<DeviceSettingsCard />)
    expect(screen.getByText(/Artwork is kept on this device/)).toBeInTheDocument()
    expect(screen.queryByText(/Keep the garden safe/)).toBeNull()
    expect(container.textContent).not.toMatch(/tablet|iPad/i)
  })

  it('offers "Vibrate on tap" only where something can buzz', () => {
    Object.defineProperty(navigator, 'vibrate', { value: () => true, configurable: true })
    pretendToBe(CHROME_MAC, 0)
    const { unmount } = render(<DeviceSettingsCard />)
    expect(screen.queryByText('Vibrate on tap')).toBeNull()
    unmount()

    pretendToBe(CHROME_ANDROID, 5)
    render(<DeviceSettingsCard />)
    expect(screen.getByText('Vibrate on tap')).toBeInTheDocument()
    delete (navigator as { vibrate?: unknown }).vibrate
  })

  it('on an iPad, still explains Add to Home Screen', () => {
    pretendToBe(SAFARI_MAC, 5)
    render(<DeviceSettingsCard />)
    expect(screen.getByText('Keep the garden safe on this iPad')).toBeInTheDocument()
    expect(screen.getByText(/Tap Share, then Add to Home Screen/)).toBeInTheDocument()
  })
})
