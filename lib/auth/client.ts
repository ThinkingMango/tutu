import { useSyncExternalStore } from 'react'
import type { AuthError, User } from '@supabase/supabase-js'
import { AFTER_SIGN_IN_COOKIE, safeNext } from '@/lib/auth/redirect'
import { forgetSavedRights } from '@/lib/billing/saved-rights'
import type { AuthClient, AuthState, ParentUser } from '@/lib/auth/types'
import { createClient } from '@/lib/supabase/client'

const LOADING: AuthState = { status: 'loading', user: null }
const SIGNED_OUT: AuthState = { status: 'signed-out', user: null }
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Left behind by the old mock account and mock checkout. A plan stored on the device must never count. */
const LEGACY_MOCK_KEYS = ['lm:mock:user', 'lm:mock:subscription']

let state: AuthState = LOADING
let started = false
const listeners = new Set<() => void>()

function toParentUser(user: User | null | undefined): ParentUser | null {
  if (!user?.email || user.is_anonymous) return null
  return { id: user.id, email: user.email }
}

function setUser(user: User | null | undefined) {
  const next = toParentUser(user)
  if (state.status !== 'loading' && state.user?.id === next?.id && state.user?.email === next?.email) {
    return
  }
  state = next ? { status: 'signed-in', user: next } : SIGNED_OUT
  listeners.forEach((listener) => listener())
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  try {
    for (const key of LEGACY_MOCK_KEYS) window.localStorage.removeItem(key)
  } catch {}
  // Fires INITIAL_SESSION immediately, then on every sign-in, refresh and sign-out (including other tabs).
  createClient().auth.onAuthStateChange((_event, session) => setUser(session?.user))
}

function rememberDestination(next: string) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${AFTER_SIGN_IN_COOKIE}=${encodeURIComponent(safeNext(next))}; Path=/; Max-Age=3600; SameSite=Lax${secure}`
}

const TOO_MANY_EMAILS =
  'We’ve sent too many sign-in emails for now. Check your inbox for an earlier link, or try again in about an hour.'

function describeRateLimit(error: AuthError) {
  // Supabase's per-address cooldown says "only request this after 42 seconds"; the project-wide cap doesn't.
  const seconds = /after (\d+) seconds?/i.exec(error.message)?.[1]
  if (seconds) return `Please wait ${seconds} seconds before asking for another sign-in email.`
  return TOO_MANY_EMAILS
}

function describeEmailLinkError(error: AuthError) {
  switch (error.code) {
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return describeRateLimit(error)
    case 'email_address_invalid':
      return 'That email address can’t receive sign-in links. Please use a different one.'
    case 'email_address_not_authorized':
      return 'Sign-in emails can’t be delivered to this address yet. Email sending is still being set up.'
    case 'signup_disabled':
    case 'otp_disabled':
      return 'New parent accounts aren’t being accepted right now.'
    default:
      if (error.status === 429) return describeRateLimit(error)
      console.error('Email link request failed', error.code ?? error.status)
      return 'We couldn’t send the sign-in email. Please try again in a moment.'
  }
}

/** Supabase sends 6 digits by default; the project can set up to 10. Spaces and dashes are ignored. */
const CODE_PATTERN = /^\d{6,10}$/

export function normalizeEmailCode(code: string) {
  return code.replace(/[\s-]/g, '')
}

function describeEmailCodeError(error: AuthError) {
  switch (error.code) {
    case 'over_request_rate_limit':
      return 'Too many tries for now. Please wait a minute, then try again.'
    case 'otp_expired':
    case 'otp_disabled':
      return 'That code didn’t work. Use the code from the newest email: each code works once and expires after an hour.'
    default:
      if (error.status === 429) return 'Too many tries for now. Please wait a minute, then try again.'
      if (error.status === 401 || error.status === 403) {
        return 'That code didn’t work. Use the code from the newest email: each code works once and expires after an hour.'
      }
      console.error('Email code sign-in failed', error.code ?? error.status)
      return 'We couldn’t check that code. Please try again in a moment.'
  }
}

export const authClient: AuthClient = {
  getState: () => state,
  subscribe(listener) {
    start()
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  async sendEmailLink(email, next) {
    const normalized = email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(normalized)) {
      throw new Error('Please enter a valid email address.')
    }
    rememberDestination(next)
    const { error } = await createClient().auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: true,
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw new Error(describeEmailLinkError(error))
  },
  async verifyEmailCode(email, code) {
    const token = normalizeEmailCode(code)
    if (!CODE_PATTERN.test(token)) throw new Error('Type the number code from the email.')
    const { error } = await createClient().auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' })
    if (error) throw new Error(describeEmailCodeError(error))
    // The emailed link would have used this to choose where to land; the code sign-in has arrived already.
    document.cookie = `${AFTER_SIGN_IN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  },
  async signOut() {
    // Whoever uses this device next mustn't inherit this parent's packs while offline.
    forgetSavedRights()
    const { error } = await createClient().auth.signOut({ scope: 'local' })
    if (error) throw new Error('Signing out didn’t finish. Please try again.')
  },
}

export function useAuthState() {
  return useSyncExternalStore(authClient.subscribe, authClient.getState, () => LOADING)
}

export function useParentUser() {
  return useAuthState().user
}
