import { MANDALAS } from '@/lib/mandalas'
import { KIDS_PACKS, isGrownUpPage, packHref } from '@/lib/packs'

/**
 * Every children's screen, kept on the device so coloring works offline (public/sw.js). The grown-up
 * area, sign-in and payments are never kept: they always need the internet.
 */
export function offlinePages(): string[] {
  return [
    '/',
    '/garden',
    ...KIDS_PACKS.map((pack) => packHref(pack.id)),
    ...MANDALAS.filter((mandala) => !isGrownUpPage(mandala)).map((mandala) => `/color/${mandala.id}`),
  ]
}
