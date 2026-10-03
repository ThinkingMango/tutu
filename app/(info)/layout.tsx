import { ArrowLeft } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { GrownUpAnalytics } from '@/components/grown-up-analytics'
import { InfoFooter } from '@/components/info/info-footer'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-secondary text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          {/* Plain links, so the children's screens start a fresh page without grown-up scripts. */}
          <a
            href="/"
            aria-label="漫涂涂首页"
            className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <BrandMark compact />
          </a>
          <a
            href="/"
            className={cn(buttonVariants({ variant: 'outline' }), 'h-11 rounded-full px-4 text-sm font-bold')}
          >
            <ArrowLeft data-icon="inline-start" />
            返回涂色
          </a>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 md:px-8 md:py-12">{children}</main>
      <InfoFooter />
      <GrownUpAnalytics />
    </div>
  )
}
