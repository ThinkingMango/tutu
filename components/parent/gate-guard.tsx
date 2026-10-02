'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { parentGateStore } from '@/lib/device-stores'
import { useHydrated, useLocalStore } from '@/lib/local-store'

export function GateGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const hydrated = useHydrated()
  const passed = useLocalStore(parentGateStore)
  const needsGate = pathname !== '/parent'
  const blocked = needsGate && (!hydrated || !passed)

  useEffect(() => {
    if (!hydrated || !needsGate || passed) return
    const destination = `${pathname}${window.location.search}`
    router.replace(`/parent?next=${encodeURIComponent(destination)}`)
  }, [hydrated, needsGate, passed, pathname, router])

  if (blocked) return <div className="min-h-[60vh]" aria-busy="true" />
  return children
}
