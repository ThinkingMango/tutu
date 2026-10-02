import type { Metadata } from 'next'
import { DeleteAccountView } from '@/components/parent/delete-account-view'

export const metadata: Metadata = { title: 'Delete account' }

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 md:px-8 md:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black">Delete your account</h1>
        <p className="leading-relaxed text-muted-foreground text-pretty">
          Removes your parent account and your family’s data. Payment records are kept for accounting without your name or email. Coloring on this device keeps working.
        </p>
      </div>
      <DeleteAccountView />
    </main>
  )
}
