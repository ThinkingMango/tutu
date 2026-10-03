import { PACK_OFFERS, averagePerPackCents, formatPrice, offerSavingsCents } from '@/lib/billing/pricing'
import { SOLD_PACKS } from '@/lib/packs'
import { cn } from '@/lib/utils'

const CRAYONS = ['bg-swatch-red', 'bg-swatch-orange', 'bg-swatch-yellow', 'bg-swatch-green', 'bg-swatch-blue']
const WORDS: Record<number, string> = { 3: '三', 5: '五' }

export function OfferGrid() {
  const available = SOLD_PACKS.length

  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {PACK_OFFERS.map((offer) => {
        const savings = offerSavingsCents(offer)
        const waiting = offer.packs > available
        return (
          <li key={offer.id} className="flex flex-col gap-4 rounded-3xl border bg-card p-6">
            <div className="flex gap-1.5" aria-hidden="true">
              {CRAYONS.slice(0, offer.packs).map((crayon) => (
                <span key={crayon} className={cn('size-5 rounded-md', crayon, waiting && 'opacity-40')} />
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-extrabold">{offer.name}</h3>
              <p className="text-sm text-muted-foreground">
                {`任选 ${offer.packs} 本画册`}
              </p>
            </div>

            <p className="flex items-baseline gap-2">
              <span className="text-4xl font-black">{formatPrice(offer.priceCents)}</span>
              <span className="text-sm text-muted-foreground">one time</span>
            </p>

            <div className="flex min-h-7 flex-wrap items-center gap-2 text-sm font-bold">
              <span>{offer.packs === 1 ? '任意一本' : `每本 ${formatPrice(averagePerPackCents(offer))}`}</span>
              {savings > 0 && (
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-primary">{`Save ${formatPrice(savings)}`}</span>
              )}
            </div>

            {waiting && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {`可选画册达到${WORDS[offer.packs] ?? offer.packs}本后开放，目前已有 ${available} 本。`}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
