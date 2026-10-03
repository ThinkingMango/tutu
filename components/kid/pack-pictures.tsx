'use client'

import { MandalaTile } from '@/components/kid/mandala-tile'
import { useEntitlements } from '@/lib/entitlements'
import { PACK_BY_ID, packPages, type PackId } from '@/lib/packs'

export function PackPictures({ packId }: { packId: PackId }) {
  const { isUnlocked } = useEntitlements()

  return (
    <ul
      className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:gap-7 lg:grid-cols-4"
      aria-label={`${PACK_BY_ID[packId].name}中的图画`}
    >
      {packPages(packId).map((mandala) => (
        <li key={mandala.id}>
          <MandalaTile mandala={mandala} locked={!isUnlocked(mandala)} />
        </li>
      ))}
    </ul>
  )
}
