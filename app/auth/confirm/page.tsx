import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: '完成登录',
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
              <h1 className="text-2xl font-black text-balance">完成登录</h1>
              <p className="leading-relaxed text-muted-foreground text-pretty">
                点击按钮，在这台设备上打开你的漫涂涂家长账号。
              </p>
            </div>
            <form method="post" action="/auth/callback" className="flex w-full flex-col">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <Button type="submit" className="h-12 w-full rounded-full text-base font-bold">
                登录漫涂涂
              </Button>
            </form>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {'没有申请登录？可以直接关闭此页面，不会有任何影响。'}
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-black text-balance">此链接不完整</h1>
              <p className="leading-relaxed text-muted-foreground text-pretty">
                登录链接不完整。请重新发送一个，并直接从邮件中打开。
              </p>
            </div>
            <Link href="/parent/sign-in" className={cn(buttonVariants(), 'h-12 w-full rounded-full text-base font-bold')}>
              获取新的登录链接
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
