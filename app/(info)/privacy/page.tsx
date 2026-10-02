import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ContactPanel,
  PolicyCard,
  PolicyHeader,
  PolicyList,
  PolicySection,
  SupportEmailLink,
} from '@/components/info/policy'
import { OPERATOR_NAME, supportMailto } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Privacy notice',
  description:
    'How Little Mandala handles information: children color without an account, pictures stay on the device, and parents choose whether to back them up.',
}

const linkClass =
  'font-bold text-primary underline decoration-2 underline-offset-4 hover:decoration-primary/40 outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50'

export default function PrivacyPage() {
  return (
    <PolicyCard>
      <PolicyHeader
        title="Privacy notice"
        intro="Little Mandala is a coloring app for young children. We built it to collect as little as possible: children never make an account, and their pictures stay on the device unless a parent chooses to back them up."
      />

      <PolicySection id="who-we-are" title="Who we are">
        <p>
          {`Little Mandala is run by ${OPERATOR_NAME}. We decide how the information described here is used, and we are responsible for looking after it. For any privacy question or request, email `}
          <SupportEmailLink href={supportMailto('Privacy question')} />.
        </p>
      </PolicySection>

      <PolicySection id="children" title="What we collect from children">
        <p>Nothing that identifies them. Children open the app and color. There is no account, sign-in or profile for a child.</p>
        <PolicyList
          items={[
            'We never ask for a child’s name, age, birthday, photo, voice, school or location.',
            'There are no ads, no chat, no public sharing and no advertising trackers.',
            'Buying packs, changing settings and cloud saving are behind a grown-up check, in a separate parent area.',
          ]}
        />
      </PolicySection>

      <PolicySection id="on-device" title="What stays on your device">
        <p>
          Pictures your child colors, the pictures in My garden, the settings you choose and whether the grown-up check was passed are kept in
          the browser’s storage on the device you use. We cannot see this information. It is not sent to us unless you turn on cloud
          saving. So coloring works without the internet, the device also keeps a copy of the children’s screens and, while you’re
          signed in, a list of the packs your account owns. That list is trusted offline for up to 30 days and removed when you sign
          out. Clearing the browser’s data for Little Mandala removes all of it.
        </p>
      </PolicySection>

      <PolicySection id="parents" title="What we collect from parents">
        <p>Only when a parent signs in, buys a pack or turns on cloud saving:</p>
        <PolicyList
          items={[
            <>
              <strong>Your email address.</strong> You sign in with a link we email to you, so there is no password to store.
            </>,
            <>
              <strong>Your purchases.</strong> Which packs you bought, the price, the date and the payment reference, so your packs open
              on every device you sign in on. Card details go straight to Stripe, our payment provider. We never see or store your card
              number. Stripe also keeps your email address and payment history, under its own privacy policy.
            </>,
            <>
              <strong>Cloud pictures, only if you turn cloud saving on.</strong> For each garden picture: which design was used, the
              colors chosen for each part, when it was made and an image of the finished picture. The{' '}
              <Link href="/parent/cloud-saving" className={linkClass}>
                cloud saving notice
              </Link>{' '}
              explains this in full, and you have to agree to it first.
            </>,
            <>
              <strong>Your permission record.</strong> When you turn on cloud saving, we record the date, the version of the notice you
              agreed to, and that you confirmed with a recent sign-in. You can download this record as a PDF, with the notice
              you agreed to, from the cloud saving page in the parent area.
            </>,
            <>
              <strong>Messages you send us.</strong> If you email support, we keep the conversation so we can help you.
            </>,
          ]}
        />
      </PolicySection>

      <PolicySection id="cookies" title="Cookies and visit statistics">
        <p>
          When a parent signs in, we set cookies that keep you signed in. They are not used for anything else. We use Vercel Web Analytics to
          count page visits in the parent area and on these policy pages, so we know which parts are used. It never runs on the
          screens your child uses. It does not use cookies and does not follow anyone across other websites. We do not use
          advertising or tracking cookies, and the children&apos;s screens have no links that leave the app.
        </p>
      </PolicySection>

      <PolicySection id="why" title="Why we use it">
        <PolicyList
          items={[
            'To sign you in and keep your account secure.',
            'To take payment and open the packs you bought.',
            'To back up and restore garden pictures, if you turned on cloud saving.',
            'To answer your questions and handle refunds.',
            'To keep records the law requires, such as payment records for accounting.',
          ]}
        />
        <p>
          We do not sell your information, share it for advertising, or use it to build a profile of you or your child.
        </p>
      </PolicySection>

      <PolicySection id="providers" title="Who helps us run the app">
        <p>These companies handle information for us, only to provide their service, and under their own security and privacy terms:</p>
        <PolicyList
          items={[
            <>
              <strong>Supabase</strong>: our database, sign-in emails and private storage for cloud pictures. Data is kept in the United
              States.
            </>,
            <>
              <strong>Stripe</strong>: takes card payments and issues refunds. Stripe also keeps your email address and payment history
              as its own records, for example to meet financial and anti-fraud laws, under the{' '}
              <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
                Stripe Privacy Policy
              </a>
              . Deleting your Little Mandala account does not delete them. To ask Stripe about them, contact Stripe directly.
            </>,
            <>
              <strong>Vercel</strong>: hosts the app and provides the visit statistics described above.
            </>,
          ]}
        />
        <p>
          We may also share information if the law requires it, for example to answer a valid legal request.
        </p>
      </PolicySection>

      <PolicySection id="how-long" title="How long we keep it">
        <PolicyList
          items={[
            'Your account and email address: until you delete your account.',
            'Cloud pictures: until you take them out of My garden, turn off cloud saving or delete your account.',
            'Payment records: kept for accounting after you delete your account, but no longer linked to your email or to you.',
            'Your email address and payment history at Stripe: kept by Stripe under its own privacy policy, including after you delete your account.',
            'Support emails: as long as we need them to help you, then deleted.',
          ]}
        />
        <p>Deleted data can stay in our providers’ encrypted backups for a short time until those backups expire.</p>
      </PolicySection>

      <PolicySection id="choices" title="Your choices and rights">
        <PolicyList
          items={[
            'Use Little Mandala without an account. Coloring works fully without one.',
            'Turn cloud saving off at any time in the parent area. This deletes every cloud copy of your pictures.',
            'Delete your account at any time in the parent area. This deletes your sign-in, cloud pictures and account records, and locks every pack you bought. You can also choose to remove the pictures from the device you delete it on.',
            'Ask us for a copy of the information we hold about you or your child, or ask us to correct or delete it.',
          ]}
        />
        <p>
          Parents and guardians can review or delete anything connected to their child at any time. Depending on where you live, you may also
          have the right to object to how we use your information, or to complain to your local data protection authority. We would like the
          chance to help first, so please get in touch.
        </p>
      </PolicySection>

      <PolicySection id="changes" title="Changes to this notice">
        <p>
          If we change this notice, we will update the date at the top. If we ever want to use cloud pictures in a new way, we will ask for
          your permission again first. We will not just change the notice.
        </p>
      </PolicySection>

      <ContactPanel title="Questions about privacy?" href={supportMailto('Privacy question')}>
        Email us and a person will reply:
      </ContactPanel>
    </PolicyCard>
  )
}
