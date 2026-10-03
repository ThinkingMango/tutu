'use client'

import { useState, useSyncExternalStore } from 'react'
import { Trash2 } from 'lucide-react'
import { DeviceStorageNotice } from '@/components/parent/device-storage-notice'
import { ParentCard } from '@/components/parent/parent-card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useArtworkLibrary } from '@/hooks/use-artwork-library'
import { useCloudSync } from '@/lib/cloud-sync/client'
import { settingsStore, type DeviceSettings } from '@/lib/device-stores'
import { useLocalStore } from '@/lib/local-store'

const TOGGLES: { key: keyof DeviceSettings; label: string; hint: string }[] = [
  { key: 'motion', label: '涂色时弹跳', hint: '每涂满一片花瓣都会轻轻晃动一下。' },
  { key: 'haptics', label: '点击时振动', hint: '每涂满一片花瓣都会轻轻振动一下。' },
]

/** Clearing can't be undone, so it takes a typed word rather than one tap a child might make. */
const CLEAR_WORD = '清除'

const noSubscribe = () => () => {}
/**
 * iPad and iPhone browsers have no vibration API, and computers have the API but nothing to buzz
 * (Chrome on a Mac), so the switch would do nothing there. A touchscreen tells them apart.
 */
function useCanVibrate() {
  return useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.vibrate === 'function' && navigator.maxTouchPoints > 0,
    () => false,
  )
}

export function DeviceSettingsCard() {
  const settings = useLocalStore(settingsStore)
  const { library } = useArtworkLibrary()
  const [cleared, setCleared] = useState(false)
  const [typed, setTyped] = useState('')
  const confirmed = typed.trim().toUpperCase() === CLEAR_WORD
  const canVibrate = useCanVibrate()
  const toggles = TOGGLES.filter((t) => t.key !== 'haptics' || canVibrate)
  const { summary } = useCloudSync()
  const cloudLine =
    summary.state === 'signed-out' || summary.state === 'off'
      ? '云端保存已关闭，所以没有其他副本，删除后将永久消失。'
      : summary.saved > 0
        ? `你账号里的 ${summary.saved} 份副本会保留。如需删除，请关闭云端保存。`
        : '你账号里已有的副本会保留。如需删除，请关闭云端保存。'

  return (
    <ParentCard
      id="this-device"
      title="这台设备"
      description="除非你开启云端保存，否则作品只保存在这台设备上。"
    >
      <DeviceStorageNotice />
      <div className="flex flex-col divide-y">
        {toggles.map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-4 py-3 first:pt-0">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={`setting-${t.key}`} className="font-bold">
                {t.label}
              </Label>
              <span className="text-sm text-muted-foreground">{t.hint}</span>
            </div>
            <Switch
              id={`setting-${t.key}`}
              checked={settings[t.key]}
              onCheckedChange={(checked) => settingsStore.write({ ...settings, [t.key]: checked })}
            />
          </div>
        ))}
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) return
          setCleared(false)
          setTyped('')
        }}
      >
        <DialogTrigger
          render={<Button variant="destructive" className="h-11 self-start rounded-full px-4 font-bold" />}
        >
          <Trash2 data-icon="inline-start" />
          清除已保存的涂色
        </DialogTrigger>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">
              {cleared ? '已全部清除' : '要清除所有已保存的涂色吗？'}
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              {cleared
                ? '每朵花都变回白色，花园也空了。'
                : `草稿和花园里的所有图画都会从这台设备上删除，且无法撤销。${cloudLine}`}
            </DialogDescription>
          </DialogHeader>
          {!cleared && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="clear-confirm" className="font-bold">
                {`输入“${CLEAR_WORD}”以确认`}
              </Label>
              <Input
                id="clear-confirm"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          )}
          <DialogFooter className="rounded-b-3xl">
            <DialogClose render={<Button variant="outline" className="h-10 rounded-full px-4" />}>
              {cleared ? '完成' : '取消'}
            </DialogClose>
            {!cleared && (
              <Button
                variant="destructive"
                className="h-10 rounded-full px-4 font-bold"
                disabled={!confirmed}
                onClick={() => {
                  library.clearAll()
                  setCleared(true)
                }}
              >
                全部清除
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ParentCard>
  )
}
