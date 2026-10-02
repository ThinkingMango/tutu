import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Finish signing in',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

type Props = { searchParams: Promise<{ token_hash?: string | string[]; type?: string | string[] }> }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function ConfirmSignInPage({ searchParams }: Props) {
  const params = await searchParams
  const tokenHash = first(params.token_hash)
  const type = first(params.type) ?? 'email'
  const usable = Boolean(tokenHash && /^[A-Za-z0-9_-]+$/.test(tokenHash))

  return (
    <main className="flex min-h-dvh items-start justify-center bg-secondary px-5 py-12 md:py-20">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border bg-card p-8 text-center">
        <Image src="/apple-icon.png" alt="" width={64} height={64} className="rounded-2xl" priority />
        {usable ? (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-black text-balance">Finish signing in</h1>
              <p className="leading-relaxed text-muted-foreground text-pretty">
                Tap the button to open your Little Mandala parent account on this device.
              </p>
            </div>
            <form method="post" action="/auth/callback" className="flex w-full flex-col">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <Button type="submit" className="h-12 w-full rounded-full text-base font-bold">
                Sign in to Little Mandala
              </Button>
            </form>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {'Didn’t ask to sign in? You can close this page. Nothing will happen.'}
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-black text-balance">This link is incomplete</h1>
              <p className="leading-relaxed text-muted-foreground text-pretty">
                Part of the sign-in link is missing. Send yourself a new one and open it straight from the email.
              </p>
            </div>
            <Link href="/parent/sign-in" className={cn(buttonVariants(), 'h-12 w-full rounded-full text-base font-bold')}>
              Get a new sign-in link
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
