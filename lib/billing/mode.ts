/**
 * Production takes real payments; previews and local development use Stripe test mode. They share
 * one database, so in production a pack bought with a test card (`source_id` starting `cs_test_`)
 * must not open anything. Live purchases (`cs_live_…`) and complimentary grants (`comp:…`) count
 * everywhere, and previews count every row so test purchases can be tried there.
 *
 * Set at build time from VERCEL_ENV in next.config.mjs, so the browser and server agree.
 */
export const LIVE_PAYMENTS = process.env.NEXT_PUBLIC_LIVE_PAYMENTS === 'true'

export function countsInThisMode(sourceId: string, live: boolean = LIVE_PAYMENTS) {
  return !live || !sourceId.startsWith('cs_test_')
}
