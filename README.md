# 漫涂涂 (Mantutu)

A calm, tablet-first coloring app for children aged 3 to 7, live at https://mandala.smartmango.ai. Children pick a picture from a pack, tap areas to fill them with color, and keep finished pictures in **My garden**. A separate area behind a grown-up check lets parents sign in, buy picture packs, turn on cloud saving, and print pictures. Every pack is a children's pack: there are no adult coloring packs.

The full product plan, pricing, data model and open gaps are in [docs/plan.md](docs/plan.md).

## Features

### For children (no account, no words needed)

- **Pack shelf**: picture packs, with locked pages that say "Ask a grown-up" and never link to pricing.
- **Coloring**: 12 colors and an eraser, Undo/Redo (50 steps), Start over, and "I'm done".
- **My garden**: finished pictures. Tapping one opens a copy to keep coloring.
- No ads, analytics, outside links or purchase prompts. `lib/child-routes.test.ts` fails if any appear, and children's screens reload before running if a grown-up page loaded outside scripts (`components/kid/grown-up-script-guard.tsx`).

### For grown-ups (`/parent`)

- **Grown-up check**: a multiplication question (such as 14 × 3) that young children can't answer. Clearing all saved coloring also needs CLEAR typed.
- **Sign in** with one email (Supabase Auth): tap its link, or type its code on another device such as the child’s tablet. No passwords.
- **Pricing**: one-time packs ($4.99 each, any 3 for $12.99, any 5 for $19.99, Standard unlock $1.99), paid with Stripe Embedded Checkout. Prices are worked out on the server.
- **Cloud saving**: optional, only after a parent agrees to the notice with a fresh sign-in.
- **Pictures**: print or download a PDF, made on the device.
- **Delete account**, device settings and policy pages (`/privacy`, `/refunds`, `/support`).

## Tech stack

Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui on Base UI, Supabase (database, auth, storage), Stripe, Vercel (hosting, analytics on grown-up pages only), Vitest.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev
```

| Script | What it does |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm test` | Run every test once |
| `pnpm typecheck` | Check types |
| `pnpm build` | Production build (fails on type errors) |
| `pnpm packs` | Add a picture pack step by step (see [art/README.md](art/README.md)) |

Every pull request runs typecheck, tests and build in GitHub Actions (`.github/workflows/ci.yml`). Don't merge a red one.

## Payments: live and test

Production (`VERCEL_ENV=production`) uses live Stripe keys and charges real cards. Previews and local development must use test keys. A key from the wrong mode is refused. Everything shares one Supabase database, so in production a pack bought with a test card doesn't open (`lib/billing/mode.ts`). Complimentary grants (`comp:…`) open everywhere.

## Database

Migrations live in `supabase/migrations/`. They are **not** applied automatically: apply each new one to the Supabase project (`supabase-teal-umbrella`) in the SQL editor or through v0, in filename order, before merging code that depends on it.

## Sign-in emails

Supabase sends the sign-in emails. `supabase/templates/` holds the designs: `magic-link.html` (sign in) and `confirm-signup.html` (new account). Each email has a link and a code (`{{ .Token }}`), and the app accepts either. Supabase keeps its own copy, so after editing a file, paste it into Supabase → Authentication → Emails → Templates. Update the templates **before** deploying app changes that depend on them.

## Project structure

```
art/                One folder per picture pack: pages, source pictures, area names
app/(kid)/          Children's screens: home, packs, coloring, My garden
app/parent/         Grown-up area, behind the grown-up check
app/(info)/         Privacy, refunds, support
app/api/            Stripe webhook, account deletion, consent PDF
app/actions/        Server actions (checkout)
components/         UI, split into coloring/, kid/, parent/, info/, ui/
lib/artwork/        On-device artwork library: drafts, garden, undo history
lib/billing/        Prices, orders, fulfilment, payment mode
lib/cloud-sync/     Optional cloud copy of garden pictures
lib/cloud-consent/  Consent notice, records and PDF receipt
lib/templates/      Traced pack pages, the generated pack registry, and the outline store
scripts/            pnpm packs and the tracer
supabase/           Database migrations and email templates
```

## How artwork is stored

Artwork lives in the browser's `localStorage` (`lm:v2:*` keys) and works without an account. Rules enforced by `lib/artwork/library.ts`:

- **Template versions are append-only.** Saved artwork is pinned to the version it was started on.
- **Garden pictures never change.** Editing one creates a copy that replaces it when saved.
- **Stored data is checked on read.** Unknown areas, colors and broken history are dropped.

## Offline coloring

The children's screens keep working without the internet once the app has been opened online. `public/sw.js` (a service worker, turned on by `components/kid/offline-support.tsx` in production only) does three things:

- **Children's pages:** fetched fresh online and kept, then served from the kept copy offline.
- **Build files:** content-hashed, so they're kept for good.
- **Grown-up area, sign-in, payments and the API:** never kept. Offline they show `public/offline.html`.

Once per deployment, after a page has loaded, the app asks the service worker to keep every children's screen (`lib/offline/pages.ts`) and every build file they lead to, including each picture's outline. That's about 2 MB to download, or about 7 MB once stored. A complete pass then drops files from earlier deployments.

Paid packs stay open offline from the last list the server confirmed (`lib/billing/saved-rights.ts`). That list is used only when the server can't be reached, trusted for 30 days, and wiped at sign-out. To test offline locally, run `pnpm build && pnpm start`, open the app once, then stop the server.

## How pictures load

A page's outline (its drawn paths) is nearly all of its size, so the app doesn't ship them all to every screen. `lib/mandalas.ts` holds each page's areas and spoken names, which is enough to save, check and announce coloring. The outline comes from `lib/templates/outlines.ts`: code-drawn pages (Standard and earlier drawings) ship with the app, and each traced page's outline is fetched the first time it's drawn, then kept for the visit. `MandalaArt` draws a blank placeholder until it arrives (`useOutline`). Anything that draws outside React, such as cloud backup, PDFs and printing, awaits `loadOutline` first. `pnpm packs sync` writes the registry in this form, so new packs need nothing extra.

## Deployment

The repository is linked to v0 and Vercel. Every merge to `main` deploys to production.
