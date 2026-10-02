import type { Metadata } from 'next'
import {
  ContactPanel,
  PolicyCard,
  PolicyHeader,
  PolicyList,
  PolicySection,
  SupportEmailLink,
} from '@/components/info/policy'
import { REFUND_WINDOW_DAYS, supportMailto } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Refund policy',
  description: `Changed your mind about a Little Mandala pack? Get a full refund within ${REFUND_WINDOW_DAYS} days of buying, no questions asked.`,
}

const REFUND_MAILTO = supportMailto('Refund request')

export default function RefundsPage() {
  return (
    <PolicyCard>
      <PolicyHeader
        title="Refund policy"
        intro={`Changed your mind? Ask within ${REFUND_WINDOW_DAYS} days of buying and we will refund you in full. No questions asked.`}
      />

      <PolicySection id="promise" title={`Full refund within ${REFUND_WINDOW_DAYS} days`}>
        <p>
          {`Every purchase is a one-time payment with no subscription. If you ask within ${REFUND_WINDOW_DAYS} days of buying, we refund the whole order, whatever the reason, even if your child has already colored the pictures.`}
        </p>
      </PolicySection>

      <PolicySection id="how" title="How to ask for a refund">
        <p>
          Email <SupportEmailLink href={REFUND_MAILTO} /> from the email address you use to sign in, or tell us that address in your message.
          The date you bought the pack also helps us find it quickly. You don’t need to give a reason.
        </p>
      </PolicySection>

      <PolicySection id="what-happens" title="What happens next">
        <PolicyList
          items={[
            'We refund the full amount through Stripe, to the card or payment method you used.',
            'Your bank usually shows the money back within 5 to 10 working days.',
            'The packs from that order lock again on your account. Free pictures and any other packs you own are not affected.',
          ]}
        />
      </PolicySection>

      <PolicySection id="bundles" title="Bundles">
        <p>
          A refund covers the whole order. If you bought several packs together at bundle prices, they are refunded and locked together. If you
          only want to return some of them, email us and we will work something out with you.
        </p>
      </PolicySection>

      <PolicySection id="deleting" title="Deleting your account">
        <p>
          Ask for any refund before you delete your account. Deleting it locks every pack you bought straight away, and they can’t be
          restored afterwards, even if you sign up again with the same email. If you have already deleted it, email us anyway from the
          same address with the date you bought, and we will look for the payment through Stripe.
        </p>
      </PolicySection>

      <PolicySection id="after" title={`After ${REFUND_WINDOW_DAYS} days`}>
        <p>Some problems should always be put right, whenever they happen. Tell us if:</p>
        <PolicyList
          items={[
            'you were charged but a pack did not open,',
            'you were charged twice for the same pack, or',
            'a pack was bought by mistake, for example by a child.',
          ]}
        />
        <p>
          We will fix it or refund you. Nothing here takes away any rights you have under the consumer laws where you live.
        </p>
      </PolicySection>

      <ContactPanel title="Ready to ask for a refund?" href={REFUND_MAILTO}>
        Email us from your sign-in address:
      </ContactPanel>
    </PolicyCard>
  )
}
