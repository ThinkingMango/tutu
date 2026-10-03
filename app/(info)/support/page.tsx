import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { PolicyCard, PolicyList, PolicySection } from '@/components/info/policy'
import { buttonVariants } from '@/components/ui/button'
import { REFUNDS_HREF, REFUND_WINDOW_DAYS, SUPPORT_EMAIL, supportMailto } from '@/lib/legal'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: '帮助与支持',
  description: `获取小小曼陀罗的帮助：画册、已保存的图画、登录和退款。请发邮件至 ${SUPPORT_EMAIL}。`,
}

const linkClass =
  'font-bold text-primary underline decoration-2 underline-offset-4 hover:decoration-primary/40 outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50'

export default function SupportPage() {
  return (
    <>
      <section
        aria-labelledby="contact"
        className="flex flex-col gap-5 rounded-3xl border bg-card p-6 md:p-10"
      >
        <div className="flex flex-col gap-3">
          <h1 id="contact" className="text-3xl font-black text-balance md:text-4xl">
            帮助与支持
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            遇到问题，或对购买有疑问？给我们发邮件，会有真人回复你。
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
          <a
            href={supportMailto('小小曼陀罗帮助')}
            className={cn(buttonVariants(), 'h-12 rounded-full px-6 text-base font-bold')}
          >
            <Mail data-icon="inline-start" />
            {`发邮件至 ${SUPPORT_EMAIL}`}
          </a>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          为了帮助我们更快回复，请附上你登录时使用的电子邮箱以及你使用的设备，例如 iPad、安卓平板或 Mac。请不要发送银行卡号。
        </p>
      </section>

      <PolicyCard>
        <h2 className="text-2xl font-black">常见问题</h2>

        <PolicySection id="pack-locked" title="我已经付款，但画册仍然是锁定的">
          <PolicyList
            items={[
              '请确认你登录的邮箱与购买画册时使用的邮箱相同。',
              '稍等一分钟后刷新页面。画册通常会在付款后几秒内解锁。',
              '仍然锁定？请发邮件告诉我们付款日期，我们会为你解锁或退款。',
            ]}
          />
        </PolicySection>

        <PolicySection id="pictures-gone" title="孩子的图画不见了">
          <p>
            图画保存在设备上，因此如果浏览器数据被清除，图画可能会丢失。iPhone、iPad 和 Mac 上的 Safari 会清除 7
            天未打开过的网站数据。为避免这种情况，在 iPhone 或 iPad 上请点击“分享”，再选择“添加到主屏幕”；在 Mac 上，请在 Safari
            中选择“文件”，再选择“添加到程序坞”（macOS Sonoma 或更高版本）。之后从那里打开小小曼陀罗，并开启
            <Link href="/parent/cloud-saving" className={linkClass}>
              云端保存
            </Link>
            ，将图画备份到你的账号。
          </p>
        </PolicySection>

        <PolicySection id="sign-in" title="我无法登录">
          <p>
            登录不需要密码。在家长区域输入你的邮箱，我们会给你发送一封包含登录链接和验证码的邮件。在你想登录的设备上点击链接，或在该设备上输入验证码，例如邮件在你的手机上、而你要在孩子的平板上登录时。如果几分钟内没有收到邮件，请检查垃圾邮件或推广邮件文件夹。一分钟后可以重新申请。
          </p>
        </PolicySection>

        <PolicySection id="refund" title="我想要退款">
          <p>
            {`在购买后 ${REFUND_WINDOW_DAYS} 天内发邮件给我们，即可全额退款，无需说明理由。`}
            <Link href={REFUNDS_HREF} className={linkClass}>
              退款政策
            </Link>
            中有详细说明。
          </p>
        </PolicySection>

        <PolicySection id="delete" title="如何删除我的账号或孩子的图画？">
          <p>
            关闭云端保存会删除你图画的所有云端副本。删除账号会移除你的登录信息、云端图画和账号记录。这两项都可以在
            <Link href="/parent/home" className={linkClass}>
              家长区域
            </Link>
            中完成。你也可以发邮件给我们，由我们替你处理。
          </p>
        </PolicySection>
      </PolicyCard>
    </>
  )
}
