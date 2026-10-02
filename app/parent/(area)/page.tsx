import { ParentGate } from '@/components/parent/parent-gate'
import { safeNext } from '@/lib/auth/redirect'

type Props = { searchParams: Promise<{ next?: string | string[] }> }

export default async function ParentGatePage({ searchParams }: Props) {
  const { next } = await searchParams

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="flex w-full max-w-lg justify-center rounded-3xl border bg-card px-6 py-10 md:px-10">
        <ParentGate next={safeNext(next)} />
      </div>
    </main>
  )
}
