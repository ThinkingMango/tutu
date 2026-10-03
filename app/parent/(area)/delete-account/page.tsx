import type { Metadata } from 'next'
import { DeleteAccountView } from '@/components/parent/delete-account-view'

export const metadata: Metadata = { title: '删除账户' }

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 md:px-8 md:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black">Delete your account</h1>
        <p className="leading-relaxed text-muted-foreground text-pretty">
          删除你的家长账号和家庭数据。付款记录会出于记账需要保留，但不包含你的姓名或邮箱。这台设备上的涂色功能仍可正常使用。
        </p>
      </div>
      <DeleteAccountView />
    </main>
  )
}
