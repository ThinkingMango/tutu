'use client'

import { useEffect } from 'react'
import { parentGateStore } from '@/lib/device-stores'

/** Entering the kid area always re-locks the grown-up area behind the gate. */
export function RelockParentArea() {
  useEffect(() => {
    parentGateStore.write(false)
  }, [])
  return null
}
