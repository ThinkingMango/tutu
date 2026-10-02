# Little Mandala — App Plan (tablet-first, ages 3–7)

**Release 1.0, the first production release**, is live at **https://mandala.smartmango.ai** (merge commit `aca3375`, PR #11 on top of PR #10).

A mandala coloring app for young children with **real parent accounts on Supabase**, **one-time pack pricing** and **live Stripe payments in production**. Children color on simple screens with no words to read. Parents buy packs, manage cloud saving, and print or download pictures from a separate area behind a parent gate. Pictures unlock only from rights rows in the database, which only the server writes after Stripe confirms payment. Stack: Next.js 16 App Router, Tailwind v4, shadcn on Base UI, lucide icons, Supabase (`@supabase/ssr`), Stripe (`stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`), Vercel Web Analytics (grown-up pages only).

## Product scope

**Little Mandala is for children aged 3 to 7. Every picture pack is a children's pack. No adult (grown-up) coloring packs are planned** (decided 2 October 2026).

- Parents still use the **grown-up area** (`/parent`) to sign in, buy their child's packs, turn on cloud saving and print pictures. "Grown-up" in this document means that parent area, not adult coloring.
- Adult packs were explored before 1.0 and never offered. Their code is **switched off, not deleted**: `GROWN_UPS_OFFERED = false` in `lib/packs.ts` hides the adult shelf, the "For you" groups on Pricing and Overview, and the `/parent/grown-ups` and `/parent/color/[id]` pages (both return "Page not found"). The draft **Zen Mandalas** pack (`art/zen-mandalas`, 12 pages) is never listed, sold or opened.
- Families are never told adult packs exist: the policy pages, Pricing and the children's screens don't mention them.
- Bringing adult packs back would be a new product decision. It would need the Zen pack finished (its pictures exceed the cloud-backup size limit), the switch turned on, and the pricing and policy pages reviewed.

## Changes since 1.0

| PR | What changed |
|---|---|
| #15 | Payment and child-safety fixes: test-mode purchases don't open packs in Production, the multiplication parent gate, CLEAR typed to clear coloring, children's screens reload if a grown-up page loaded outside scripts, a database fix for checkouts recorded twice at once, and CI on every pull request. |
| #16 | Sign-in emails carry a code as well as a link, so a parent can sign in on the child's tablet with the email open on a phone. |
| #17 | Faster loading: each screen downloads only the picture outlines it draws. |
| #18 | Offline coloring for the children's screens. Packs bought or refunded during a visit now show without a reload. |
| #19 | The parent area names the right device (no more "this tablet" on a Mac), and Safari users on a Mac are told how to keep pictures safe. |

## Release 1.0 at a glance

| Area | What shipped |
|---|---|
| Children's app | Pack shelf, coloring screen, **My garden**. No ads, analytics, purchase prompts or links out. |
| Packs | **10 published packs, 154 pages**, all for children. |
| Parent area | Gate, email sign-in, Overview, **Pictures** (print and PDF), Pricing and checkout, Cloud saving, Delete account. |
| Payments | **Stripe live mode in Production.** Preview and Development use test keys and never fall back to live ones. |
| Privacy | Artwork stays on the device unless a parent opts into cloud saving with recorded consent. Analytics runs only on grown-up pages. |
| Policy pages | `/privacy`, `/refunds`, `/support`. |
| Hardening | Security headers on every response. A test fails if trackers or outside links reach the children's pages. |
| Tests | **187 in 16 files**, all passing. Type check clean. |

## Changes from the original plan

| Area | Original plan | Release 1.0 |
|---|---|---|
| Billing platform | **Paddle Billing** | **Stripe.** Embedded Checkout in a dialog on the Pricing page, a signed webhook at `/api/stripe/webhook`, and prices sent inline from our own price table. **Live in Production**, with test keys in Preview and Development. |
| Pricing model | Free vs **Family plan** (subscription), plus single packs | **No subscription.** Every pack is **$4.99 one time**. Bundles: any 3 for $12.99, any 5 for $19.99. Standard's 6 locked pages: **$1.99 one time**. Everything bought is kept for good. |
| Family plan | The main way to unlock everything | **Removed.** A `membership` row opens nothing. |
| Pricing page | Plan cards | Offer cards, a pack picker with a live order summary, the cheapest mix of bundles, an "add N more to reach a bundle" nudge, and **Buy** with Stripe checkout. |
| Parent overview | Account, plan, every picture, settings | One column: Picture packs, **Pictures**, Account, Cloud saving, This device. |
| Printing and export | Not planned | **Pictures page**: per-picture save state, then **Print** or **Download PDF**, made on the device. |
| Packs | 5 packs, 74 pages | **10 published packs (154 pages)**, all for children. |
| Saved pictures | One draft per page | **My garden**: finished pictures live on their own page, and pack pages always start white. |
| Audience | Children only | **Still children only.** The code supports a `grown-ups` audience, but no adult packs are planned (see Product scope). |
| Analytics | Site-wide | **Grown-up pages only**, with events from children's pages dropped as well. |
| Tests | 80 | 187 in 16 files. |

## Pricing

All prices are in `lib/billing/pricing.ts`, in US cents. None depends on how many pages a pack has.

| Offer | Price | Per pack |
|---|---|---|
| One pack (`single`) | $4.99 | $4.99 |
| Any three packs (`bundle-3`) | $12.99 | $4.33 |
| Any five packs (`bundle-5`) | $19.99 | $4.00 |
| Finish the Standard pack (6 pages) | $1.99 | — |

- `quotePacks(n)` works out the cheapest mix for exactly `n` packs. For example, 4 packs = a three-pack bundle plus one single, $17.98.
- `bundleNudge(selected, available)` suggests more packs only when enough unowned ones remain and the bundle beats buying them singly.
- Owned packs show "Yours to keep" and can't be chosen again. Only **published** packs are sold (`SOLD_PACKS`).
- A bundle isn't an entitlement of its own. After payment, each chosen pack gets its own `scope = 'pack'` row.

## Payments (Stripe)

**Modes** (`lib/stripe.ts`): Every environment reads `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Production (`VERCEL_ENV=production`) requires live keys and uses `STRIPE_LIVE_WEBHOOK_SECRET`. Preview and local development require test keys and use `STRIPE_WEBHOOK_SECRET`; a live key there is rejected. The live account can take charges and receive payouts.

**Checkout** (`app/actions/checkout.ts`, `components/parent/pricing/checkout-dialog.tsx`):
1. The parent picks packs on `/parent/billing` and taps Buy. The browser sends only pack ids, the Standard flag and a random attempt id.
2. `startPackCheckout` checks the signed-in parent and rebuilds the order on the server with `buildOrder` (`lib/billing/order.ts`). It rejects unknown, draft or owned packs, empty orders and more than 40 packs, then prices the order from `lib/billing/pricing.ts`. Nothing the browser sends sets a price.
3. It creates a Checkout Session (`mode: 'payment'`, `ui_mode: 'embedded_page'`, inline USD `price_data`, `metadata.parent_id` and `metadata.pack_ids`). It reuses the parent's Stripe customer **for that mode**, or creates one. The idempotency key `pack-checkout:<parent>:<attemptId>` prevents a second session on a double tap or retry.
4. Card details go straight to Stripe and never reach our server.

**Opening packs right away:** `confirmPackCheckout(sessionId)` fetches the finished session and grants the packs at once, only for the parent who started it. Payment methods that leave the page return to `/parent/billing?session_id=…`, which runs the same step. Rights rows accept a `starts_at` up to 5 minutes ahead of the device's clock.

**Webhook** (`app/api/stripe/webhook/route.ts`):
- The signature is checked with the mode's signing secret. Unsigned or badly signed requests get a 400 (confirmed on production).
- Events from the other mode are ignored.
- Every event is logged in `webhook_events` with its attempt count and last error. It's handled at most once, and a failure returns 500 so Stripe retries.
- `checkout.session.completed` and `checkout.session.async_payment_succeeded` fulfil the order. `checkout.session.async_payment_failed` grants nothing. `charge.refunded` for a full refund marks the transaction `refunded` and revokes its packs.
- Live endpoint: `https://mandala.smartmango.ai/api/stripe/webhook` with those four events. A second live webhook, going to a Grok connector, wasn't made by this app and is left alone.

**Fulfilment** (`lib/billing/fulfil.ts` → SQL `fulfil_checkout_session`): records the customer for the session's mode, one `transactions` row per paid session and one `pack` entitlement per pack, all or nothing. It's safe to run twice, because the confirm step and the webhook both call it.

## Routes

| Route | Audience | Purpose |
|---|---|---|
| `/` | Kid | Home: pack shelf, **My garden** card (three newest pictures and a count), small parent entry in the corner. |
| `/packs/[id]` | Kid | One pack's pictures. Locked ones show a lock and "Ask a grown-up", never a link to pricing. |
| `/color/[id]` | Kid | Coloring: white canvas, palette and eraser, Undo, Start over, Done. `?art=<artworkId>` reopens a garden picture. |
| `/garden` | Kid | My garden: every finished picture, newest first. |
| `/parent` | Parent gate | Answer a multiplication (12–19 × 3–5). There's no press-and-hold, which a child can pass alone. Sets `sessionStorage["lm:gate"]`. Counts as a children's screen for analytics. "Clear saved coloring" behind it also needs CLEAR typed. |
| `/parent/sign-in` | Parent | One email through Supabase Auth with a link and a code: tap the link on this device, or type the code (for an email open on another device). Both count as a fresh sign-in. |
| `/auth/callback`, `/auth/confirm` | Server | Finish the email-link sign-in. |
| `/parent/home` | Parent | Overview: Picture packs, Pictures, Account, Cloud saving, This device ("Clear saved coloring", sign out). |
| `/parent/pictures` | Parent | **Pictures**: each garden picture's save state (this device only / also in your account / not copied yet), then **Print** or **Download PDF**, one picture per page with its name and date. Made on the device, and nothing is uploaded. |
| `/parent/billing` | Parent | Pricing, pack picker, order summary, the Standard unlock and **Buy**. Also confirms returning checkouts. |
| `/parent/grown-ups`, `/parent/color/[id]` | — | **Switched off.** Always "Page not found", because no adult packs are offered (`GROWN_UPS_OFFERED = false`). |
| `/parent/cloud-saving` | Parent | Opt in to copying finished pictures to the account (needs recorded consent). |
| `/parent/delete-account` | Parent | Deletes the account. Payment records are kept as the law requires. |
| `/privacy`, `/refunds`, `/support` | Grown-ups | Policy and help pages. |
| `/api/account` | Server | Account actions that need the service role. |
| `/api/stripe/webhook` | Server | Verified Stripe events. |

Layouts and child safety:
- `app/(kid)/layout.tsx`: full-bleed white, with no text navigation, links out, purchase prompts or analytics.
- `lib/child-routes.test.ts` walks every module the kid routes load. It fails on tracker packages or snippets, outside links, new windows, pricing links or grown-up-only modules.
- Vercel Web Analytics is mounted only by `app/parent/layout.tsx` and `app/(info)/layout.tsx` (`components/grown-up-analytics.tsx`). Its `beforeSend` drops any event not on a grown-up page (`lib/audience-routes.ts`).
- `app/parent/layout.tsx` gives the calmer parent UI, and every parent route except `/parent` checks the gate flag. The header and footer are hidden when printing.
- `next.config.mjs` sends security headers: nosniff, referrer policy, HSTS, `X-Frame-Options: SAMEORIGIN` and a permissions policy (confirmed on production).

## Data

One Supabase project serves Production, Preview and Development. It has 9 migrations in `supabase/migrations/`, all applied, the last being `20261001120000_fulfil_checkout_race.sql` (applied 1 October 2026), and every table has owner-only RLS.
- `profiles`, `consent_notices`, `consent_records`: parent accounts and the consent notice they agreed to (notice v2 is approved).
- `artworks`, `artwork_deletions`: cloud copies of pictures, only after cloud-saving consent (`has_cloud_consent()`).
- `billing_customers`: keyed by `(parent_id, livemode)`, so each parent has separate test and live Stripe customers. Rows from before the live launch are test mode.
- `transactions`: one row per paid Checkout Session, plus a generated `livemode` column (true for `cs_live_…` sessions).
- `webhook_events` is written only by the server. `subscriptions` is unused and kept in case a subscription comes back.
- `entitlements`: what a parent can open. `scope = 'pack'` with a `pack_id` opens one pack for good. For purchases, `source_id` is the Checkout Session id. **Complimentary grants** use `source_type = 'transaction'` with `source_id = 'comp:<pack>:<parent>'`, which never matches a Stripe session, refund or order. A row counts only while `revoked_at` is null and it's inside its `starts_at`/`ends_at` window.
- Deleting a parent sets `transactions.stripe_customer_id` to null instead of deleting the payment record.

Access check: `lib/entitlements.ts` loads the parent's `pack` rows, and `canColor(page)` decides each page. Free pages are always open. A `standard` row opens Standard's 6 locked pages, and no row opens everything.

On-device storage: artwork stays on the device unless the parent turns on cloud saving.

## My garden and saving rules

Logic is in `startSession` and `saveSession` in `lib/artwork/library.ts`, used through `hooks/use-coloring.ts`:
- **From a pack:** a page always opens white, and unsaved coloring is dropped when the child leaves.
- **"I'm done":** the picture goes to My garden.
- **From My garden:** the page opens with its colors, and saving updates it in place. It gets a new id, and the old id is marked removed so cloud sync replaces the cloud copy.
- Per-picture save state for the Pictures page comes from `lib/cloud-sync/picture-state.ts`.

## Printing and PDF

- `lib/export/pictures-pdf.ts` builds the PDF, one picture per page with its name and date, and `lib/export/rasterize.ts` draws each picture in the browser. Nothing is uploaded.
- Print uses `components/parent/pictures/print-sheet.tsx`, with the parent header and footer hidden on paper and a 14mm `@page` margin.
- Saved picture files and PDFs use the same bold outline as the screen (`lib/cloud-sync/artwork-svg.ts`).

## Palette

- **Children: 12 colors** in six bold/soft pairs (`PALETTE`), with swatches of 64px on tablets and 44px on phones.
- A 24-color adult palette (`GROWN_UP_FAMILIES`) is still in the code for the switched-off adult packs. Children never see it.
- Color keys never change once shipped, because saved artwork stores them. `ALL_COLORS` holds all 36 keys.

## Picture packs

| Pack | Audience | Status | Pages | How it unlocks |
|---|---|---|---|---|
| Standard | Children | Published | 10 (4 free, 6 locked) | The $1.99 Standard unlock |
| Ocean Friends | Children | Published | 16 | $4.99, or part of a bundle |
| Safari Garden | Children | Published | 16 | $4.99, or part of a bundle |
| Easter Garden | Children | Published | 16 | $4.99, or part of a bundle |
| Christmas Garden | Children | Published | 16 | $4.99, or part of a bundle |
| Ocean Friends 2 (`ocean-friends-two`) | Children | Published | 16 | $4.99, or part of a bundle |
| Safari Garden 2 (`safari-garden-two`) | Children | Published | 16 | $4.99, or part of a bundle |
| Christmas Garden 2 (`christmas-garden-two`) | Children | Published | 16 | $4.99, or part of a bundle |
| Flowers Garden | Children | Published | 16 | $4.99, or part of a bundle |
| Surprise Garden | Children | Published | 16 | $4.99, or part of a bundle |
| Zen Mandalas | Grown-ups | **Shelved draft, not planned** | 12 | Never listed or sold (see Product scope) |

- 154 published pages, all for children, and nine packs are sold separately. Draft packs appear only in local development and the v0 preview, and the Zen draft stays hidden even there because `GROWN_UPS_OFFERED` is `false`.
- New packs are children's packs (`pnpm packs new` without `--audience`).
- Each pack lives in `art/<pack>/pages.json`. `pnpm packs sync` generates `lib/templates/registry.generated.ts`.
- The art rules (`AUDIENCE_RULES` in `scripts/trace-pack/segment.ts`) and the pipeline (`pnpm packs new | prompts | trace | sheet | labels | status | publish`) are unchanged. See `art/README.md`.

## Offline

The children's area works without the internet after one online visit.

- **Service worker:** `public/sw.js`, registered by `components/kid/offline-support.tsx` in production.
- **What it keeps:** all 166 children's screens and every build file they lead to. That's about 2 MB to download (about 7 MB once stored), refreshed once per deployment.
- **What it never keeps:** the grown-up area, sign-in and payments. Offline they show `public/offline.html`.
- **Paid packs offline:** they open from the last list the server confirmed, for 30 days, wiped at sign-out (`lib/billing/saved-rights.ts`). That list also shows straight away online while the server is asked again.

Checked in a real browser with the server shut down:

- browsing, coloring, "I'm done", My garden and traced packs
- paid packs while signed in, and after the sign-in lapsed
- the grown-up area showing the offline page
- a refund locking a remembered pack again

Fixed along the way: SWR's default comparison (`dequal/lite`) can't see inside the `Set` of packs, so a pack bought or refunded during a visit didn't show until a reload. `useEntitlements` now passes `compare: sameRights`.

## Loading

Each page downloads only the outlines it draws (`lib/templates/outlines.ts`). Before this, every screen shipped all 154 outlines, about 800 KB compressed. Up front, each screen now downloads about 290–330 KB of code. With the outlines it then fetches, that comes to about 455 KB for Home (27 pack-cover pictures), 362 KB for a pack page and 323 KB for one picture, against about 1,050 KB for every page before. A new pack adds only its three cover pictures to Home, and nothing to other pages. A test fails if the registry bundles an outline again.

## UI and accessibility

- Pure white canvas with bold charcoal outlines. The palette and tools sit on the sides in landscape, and along the bottom and top in portrait.
- Controls have an icon, an `aria-label` and a focus ring, and are at least 44px on phones and 64px on tablets.
- Start over and removing a garden picture both ask first with a big Yes/No dialog.
- Motion respects `prefers-reduced-motion`. Nunito, light mode only.

## Tests

`pnpm test`: **248 tests in 27 files** (after PR #19), all passing, and `pnpm exec tsc --noEmit` is clean. 1.0 shipped with 187 tests in 16 files.
- Pack manifests, art rules, unique ids and `SOLD_PACKS`. `lib/grown-up-packs.test.ts` checks that adult packs stay hidden while the switch is off.
- Pricing, checkout order building and rejections, and unlock rules.
- Saving rules, palettes, tracer, coloring screen, cloud consent and the cloud-sync engine.
- **New in 1.0:** child routes stay free of trackers, outside links and pricing, and analytics only counts grown-up pages (`lib/child-routes.test.ts`). Per-picture save state (`lib/cloud-sync/picture-state.test.ts`) and the pictures PDF (`lib/export/pictures-pdf.test.ts`) are covered too.
- Live Supabase tests (`.v0-live/`) cover cloud sync and account isolation, and run separately.

## Test account

`lawrence.law@hotmail.com` (user `b8986e6c-…`) holds five **complimentary grants** (`comp:…`), permanent, with no charge or order: **Standard, Ocean Friends, Christmas Garden, Easter Garden and Safari Garden**. They open in every environment, including Production.

Still locked for this account: Ocean Friends 2, Safari Garden 2, Christmas Garden 2, Flowers Garden and Surprise Garden. In Preview, test purchases use card `4242 4242 4242 4242`. On production, any purchase charges a real card.

## Open gaps

1. **Fixed: test-mode rights no longer open packs in Production.** `lib/billing/mode.ts` ignores rows whose `source_id` starts with `cs_test_` when `VERCEL_ENV=production`, both on the device and in checkout's "already owned" check. Complimentary grants still count. The test account's packs are now `comp:` grants, so they stay open on the live site.
2. **Preview checkout is broken.** The test Stripe keys are empty since the sandbox integration was disconnected, so Buy shows an error in Preview. Add `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_WEBHOOK_SECRET` from Stripe test mode, scoped to Preview and Development.
3. **No live purchase has been tested end to end.** The keys, account status, webhook endpoint and signature rejection are confirmed, but the first real charge and refund haven't been run.
4. **Partial refunds revoke nothing.** Only a full refund closes packs. Partial refunds are handled by hand in the Stripe dashboard.
5. **Complimentary grants are hand-written SQL.** There's no admin screen or audit trail beyond the `comp:` source id.
6. **Decided: no adult packs.** The code stays switched off (`GROWN_UPS_OFFERED = false`) and the Zen draft is shelved. See Product scope. Optional clean-up: delete the adult-pack code and the Zen draft, so there's less to maintain.
7. **Fixed: the unused `NotConnectedBadge` is deleted**, along with the unused `cn` package.
8. **Print dialog not checked in a browser.** The print styles are compiled and the PDF was tested, but the browser print preview hasn't been checked.

## Next steps (after 1.0)

1. **Smoke test live payments:** buy the $1.99 Standard unlock on production with a real card on an account that doesn't own it, check it opens without a reload and appears in `transactions` with `livemode = true`, then refund it in full and check it locks again.
2. **Restore Preview checkout** with the Stripe test keys (the gap 1 fix is live).
3. **Keep CI green:** every pull request runs typecheck, tests and build, and builds fail on type errors.
4. **Check the sign-in emails in Supabase** match `supabase/templates/` (with the code), and that `support@smartmango.ai` receives mail, since every policy page points families there.
5. **Optional:** delete the switched-off adult-pack code and the Zen draft (gap 6).
6. **Optional:** a small admin action for complimentary grants and revocations, so they don't need SQL.

Done since 1.0: `20261001120000_fulfil_checkout_race.sql` was applied on 1 October 2026.

## Release checklist (1.0)

- [x] Live Stripe keys in Production only, with previews on test keys and no fallback.
- [x] Live webhook registered with 4 events, and signature rejection confirmed on production.
- [x] `stripe_live_mode` migration applied (per-mode customers, `transactions.livemode`).
- [x] Children's pages free of analytics, trackers and outside links, with a guard test.
- [x] Pictures page with print and PDF export, and clear save states.
- [x] Security headers live.
- [x] 187 tests and the type check passing, with PR #11 merged and deployed.
- [ ] First live purchase and full refund (next step 1).
- [x] Test-mode rights no longer open packs in Production (gap 1).
- [x] Stripe.js loads only when checkout opens, and children's screens reload before running if a grown-up page loaded outside scripts.

## Verification

- Click through every route at tablet landscape (1180×820), portrait (820×1180) and phone (390×844).
- In Preview (once test keys are back), buy a pack with the test card. It should open without a reload, and appear once in `transactions` and once per pack in `entitlements`. Replaying the webhook must not duplicate anything, and a full refund must lock it again.
- On production, run the smoke test in next step 1.
- Locked tiles on children's pages never link to pricing, and the charged amount matches the order summary.
- Pictures page: the save states are right, Print shows one picture per page with no site chrome, and the PDF has one page per chosen picture.
- `pnpm exec tsc --noEmit` and `pnpm test` both pass.
