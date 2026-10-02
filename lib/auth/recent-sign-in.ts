import useSWR, { mutate } from 'swr'
import { latestSignInAt } from '@/lib/cloud-consent/notice'
import { createClient } from '@/lib/supabase/client'

async function fetchSignedInAt(): Promise<Date | null> {
  const { data } = await createClient().auth.getClaims()
  return latestSignInAt(data?.claims?.amr)
}

/** When this session last signed in from an email (link or code). The server makes the final check. */
export function useRecentSignIn(userId: string | null) {
  return useSWR(userId ? (['recent-sign-in', userId] as const) : null, fetchSignedInAt, {
    revalidateOnFocus: true,
  })
}

/**
 * After signing in again on the same page (with an emailed code), re-reads the sign-in time so
 * buttons that need a recent sign-in unlock without a reload. Cloud saving reads it too.
 */
export async function refreshRecentSignIn(): Promise<void> {
  await mutate((key) => Array.isArray(key) && (key[0] === 'recent-sign-in' || key[0] === 'cloud-consent'))
}
