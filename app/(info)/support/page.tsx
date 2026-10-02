import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { PolicyCard, PolicyList, PolicySection } from '@/components/info/policy'
import { buttonVariants } from '@/components/ui/button'
import { REFUNDS_HREF, REFUND_WINDOW_DAYS, SUPPORT_EMAIL, supportMailto } from '@/lib/legal'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Help and support',
  description: `Get help with Little Mandala: packs, saved pictures, signing in and refunds. Email ${SUPPORT_EMAIL}.`,
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
            Help and support
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            Something not working, or a question about a purchase? Email us and a person will reply.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
          <a
            href={supportMailto('Little Mandala help')}
            className={cn(buttonVariants(), 'h-12 rounded-full px-6 text-base font-bold')}
          >
            <Mail data-icon="inline-start" />
            {`Email ${SUPPORT_EMAIL}`}
          </a>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          To help us answer quickly, include the email address you sign in with and the device you use, for example iPad, Android tablet or Mac.
          Please don’t send card numbers.
        </p>
      </section>

      <PolicyCard>
        <h2 className="text-2xl font-black">Common questions</h2>

        <PolicySection id="pack-locked" title="I paid, but the pack is still locked">
          <PolicyList
            items={[
              'Check you are signed in with the same email address you used to buy the pack.',
              'Wait a minute, then reload the page. Packs usually open a few seconds after paying.',
              'Still locked? Email us with the date you paid and we will open it or refund you.',
            ]}
          />
        </PolicySection>

        <PolicySection id="pictures-gone" title="My child’s pictures disappeared">
          <p>
            Pictures are kept on the device, so they can be lost if the browser’s data is cleared. Safari on iPhone, iPad and Mac clears
            sites that have not been opened for 7 days. To avoid this, on iPhone or iPad tap Share, then Add to Home Screen. On a Mac,
            choose File, then Add to Dock in Safari (macOS Sonoma or later). Then open Little Mandala from there, and turn on{' '}
            <Link href="/parent/cloud-saving" className={linkClass}>
              cloud saving
            </Link>{' '}
            to back pictures up to your account.
          </p>
        </PolicySection>

        <PolicySection id="sign-in" title="I can’t sign in">
          <p>
            There is no password. Enter your email in the parent area and we send you an email with a sign-in link and a code. Tap the
            link on the device you want to sign in, or type the code on it, for example when the email is on your phone and you’re
            signing in on your child’s tablet. If it doesn’t arrive within a few minutes, check your spam or promotions folder. You can
            ask for a new one after a minute.
          </p>
        </PolicySection>

        <PolicySection id="refund" title="I want a refund">
          <p>
            {`Email us within ${REFUND_WINDOW_DAYS} days of buying for a full refund, no questions asked. The `}
            <Link href={REFUNDS_HREF} className={linkClass}>
              refund policy
            </Link>{' '}
            explains how it works.
          </p>
        </PolicySection>

        <PolicySection id="delete" title="How do I delete my account or my child’s pictures?">
          <p>
            Turning off cloud saving deletes every cloud copy of your pictures. Deleting your account removes your sign-in, cloud pictures
            and account records. You can do both in the{' '}
            <Link href="/parent/home" className={linkClass}>
              parent area
            </Link>
            . You can also email us and we will do it for you.
          </p>
        </PolicySection>
      </PolicyCard>
    </>
  )
}
