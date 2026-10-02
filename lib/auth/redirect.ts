export const DEFAULT_AFTER_SIGN_IN = '/parent/home'

/** Remembers where to go after the emailed link is opened, without adding query params to the allow-listed callback URL. */
export const AFTER_SIGN_IN_COOKIE = 'lm_after_sign_in'

/** Only same-site grown-up pages are allowed as post-sign-in destinations. */
export function safeNext(value: string | string[] | null | undefined) {
  const next = Array.isArray(value) ? value[0] : value
  if (!next || !next.startsWith('/parent/') || next.includes('\\') || next.includes('//')) {
    return DEFAULT_AFTER_SIGN_IN
  }
  return next
}
