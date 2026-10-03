import type { Metadata } from 'next'
import { SignInForm, type LinkError } from '@/components/parent/sign-in-form'
import { safeNext } from '@/lib/auth/redirect'

export const metadata: Metadata = { title: '家长登录' }

type Props = { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> }

function parseLinkError(value: string | string[] | undefined): LinkError | null {
  const error = Array.isArray(value) ? value[0] : value
  return error === 'expired' || error === 'link' ? error : null
}

export default async function SignInPage({ searchParams }: Props) {
  const { next, error } = await searchParams

  return (
    <main className="flex flex-1 items-start justify-center px-5 py-12 md:py-16">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border bg-card p-6 md:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black">Parent sign in</h1>
          <p className="leading-relaxed text-muted-foreground">
            只有大人才有账号，孩子无需登录。
          </p>
        </div>
        <SignInForm next={safeNext(next)} linkError={parseLinkError(error)} />
      </div>
    </main>
  )
}
