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
  '登录邮件发送次数过多。请查看收件箱中之前的链接，或约一小时后再试。'

function describeRateLimit(error: AuthError) {
  // Supabase's per-address cooldown says "only request this after 42 seconds"; the project-wide cap doesn't.
  const seconds = /after (\d+) seconds?/i.exec(error.message)?.[1]
  if (seconds) return `请等待 ${seconds} 秒后再申请新的登录邮件。`
  return TOO_MANY_EMAILS
}

function describeEmailLinkError(error: AuthError) {
  switch (error.code) {
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return describeRateLimit(error)
    case 'email_address_invalid':
      return '该邮箱地址无法接收登录链接，请换一个邮箱。'
    case 'email_address_not_authorized':
      return '暂时无法向该地址发送登录邮件，邮件服务仍在配置中。'
    case 'signup_disabled':
    case 'otp_disabled':
      return '目前暂不接受新的家长账户注册。'
    default:
      if (error.status === 429) return describeRateLimit(error)
      console.error('Email link request failed', error.code ?? error.status)
      return '登录邮件发送失败，请稍后再试。'
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
      return '尝试次数过多，请等待一分钟后再试。'
    case 'otp_expired':
    case 'otp_disabled':
      return '验证码无效。请使用最新邮件中的验证码：每个验证码只能使用一次，并在一小时后失效。'
    default:
      if (error.status === 429) return '尝试次数过多，请等待一分钟后再试。'
      if (error.status === 401 || error.status === 403) {
        return '验证码无效。请使用最新邮件中的验证码：每个验证码只能使用一次，并在一小时后失效。'
      }
      console.error('Email code sign-in failed', error.code ?? error.status)
      return '暂时无法验证该验证码，请稍后再试。'
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
