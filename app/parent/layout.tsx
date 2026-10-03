import type { Metadata } from 'next'
import { GrownUpAnalytics } from '@/components/grown-up-analytics'
import { GateGuard } from '@/components/parent/gate-guard'

export const metadata: Metadata = {
  title: '家长区',
  robots: { index: false },
}

/** Everything under /parent is behind the gate. The header lives in (area), so grown-up coloring can be full screen. */
export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <GateGuard>
      {children}
      <GrownUpAnalytics />
    </GateGuard>
  )
}
