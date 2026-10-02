/**
 * Grown-up pages may load outside scripts: Stripe.js on Pricing and Vercel Web Analytics. Moving
 * to a children's screen without a full page load would leave them running, so grown-up pages mark
 * the document and the kids' layout reloads any marked document before a child uses it.
 *
 * The mark lives on `window`, so it lasts exactly as long as the scripts it stands for.
 */
const MARK = '__littleMandalaGrownUpScripts'

type MarkedWindow = Window & { [MARK]?: true }

export function markGrownUpDocument() {
  if (typeof window !== 'undefined') (window as MarkedWindow)[MARK] = true
}

export function isGrownUpDocument() {
  return typeof window !== 'undefined' && (window as MarkedWindow)[MARK] === true
}
