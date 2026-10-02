import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  // When Supabase rejects emailRedirectTo it falls back to the bare Site URL, so the
  // sign-in code lands on the home page. Hand it to the callback instead of dropping it.
  if (pathname === '/' && (searchParams.has('code') || searchParams.has('error_code'))) {
    const callback = request.nextUrl.clone()
    callback.pathname = '/auth/callback'
    return NextResponse.rewrite(callback)
  }
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)'],
}
