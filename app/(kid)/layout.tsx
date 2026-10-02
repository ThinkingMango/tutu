import { GrownUpScriptGuard } from '@/components/kid/grown-up-script-guard'
import { OfflineSupport } from '@/components/kid/offline-support'
import { RelockParentArea } from '@/components/kid/relock-parent-area'
import { offlinePages } from '@/lib/offline/pages'

/** Worked out on the server, so the list costs the browser nothing but the list itself. */
const OFFLINE_PAGES = offlinePages()

export default function KidLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <GrownUpScriptGuard>
        <RelockParentArea />
        {children}
      </GrownUpScriptGuard>
      <OfflineSupport pages={OFFLINE_PAGES} />
    </div>
  )
}
