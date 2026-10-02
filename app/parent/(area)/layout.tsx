import { InfoFooter } from '@/components/info/info-footer'
import { ParentHeader } from '@/components/parent/parent-header'

export default function ParentAreaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-secondary print:min-h-0 print:bg-background">
      <ParentHeader />
      {children}
      <div className="print:hidden">
        <InfoFooter />
      </div>
    </div>
  )
}
