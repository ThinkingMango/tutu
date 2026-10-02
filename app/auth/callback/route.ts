import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { AFTER_SIGN_IN_COOKIE, safeNext } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/server'

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = ['magiclink', 'signup', 'email']

type LinkParams = {
  code: string | null
  tokenHash: string | null
  type: string | null
  errorCode: string | null
}

function isEmailOtpType(type: string | null): type is EmailOtpType {
  return EMAIL_OTP_TYPES.includes(type as EmailOtpType)
}

async function finishSignIn(request: NextRequest, params: LinkParams, status: 303 | 307) {
  const next = safeNext(request.cookies.get(AFTER_SIGN_IN_COOKIE)?.value)
  const { code, tokenHash, type } = params

  let failure: 'expired' | 'link' | null = params.errorCode === 'otp_expired' ? 'expired' : 'link'

  if (code || (tokenHash && isEmailOtpType(type))) {
    const supabase = await createClient()
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash! })
    failure = error ? (error.code === 'otp_expired' ? 'expired' : 'link') : null
  }

  const target = failure
    ? `/parent/sign-in?error=${failure}&next=${encodeURIComponent(next)}`
    : next
  // Relative Location: behind a proxy, request.nextUrl.origin can mix the forwarded
  // protocol with the internal host, so let the browser resolve against the URL it used.
  const response = new NextResponse(null, { status, headers: { Location: target } })
  response.cookies.delete(AFTER_SIGN_IN_COOKIE)
  return response
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  return finishSignIn(
    request,
    {
      code: searchParams.get('code'),
      tokenHash: searchParams.get('token_hash'),
      type: searchParams.get('type'),
      errorCode: searchParams.get('error_code'),
    },
    307,
  )
}

/** The emailed link opens /auth/confirm, whose button posts here, so mail scanners that only fetch links can't use up the one-time token. */
export async function POST(request: NextRequest) {
  const form = await request.formData()
  const field = (name: string) => {
    const value = form.get(name)
    return typeof value === 'string' && value.length > 0 ? value : null
  }
  return finishSignIn(
    request,
    { code: null, tokenHash: field('token_hash'), type: field('type'), errorCode: null },
    303,
  )
}
