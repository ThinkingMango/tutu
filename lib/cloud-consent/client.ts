import useSWR from 'swr'
import { latestSignInAt } from '@/lib/cloud-consent/notice'
import { createClient } from '@/lib/supabase/client'

const PURPOSE = 'cloud_artwork_sync'
const ARTWORK_BUCKET = 'artwork'
const REMOVE_BATCH = 100
const MAX_REMOVE_ROUNDS = 50

export type ConsentNotice = { version: number; title: string; body: string; approvedAt: Date }
export type ActiveConsent = { noticeVersion: number; givenAt: Date }
export type CloudConsentStatus = {
  /** The newest notice in force: what a parent agrees to now. */
  notice: ConsentNotice | null
  consent: ActiveConsent | null
  /** The notice the active consent points at, while it is still in force. Null once it is retired. */
  agreedNotice: ConsentNotice | null
  signedInAt: Date | null
}

type NoticeRow = { version: number; title: string; body: string; approved_at: string; retired_at: string | null }

function toNotice(row: NoticeRow): ConsentNotice {
  return { version: row.version, title: row.title, body: row.body, approvedAt: new Date(row.approved_at) }
}

/** Matches has_cloud_consent() in the database: the agreed notice must be approved and not retired. */
export function isCloudSavingOn(status: CloudConsentStatus | undefined) {
  return Boolean(status?.consent && status.agreedNotice)
}

type ErrorCode = 'recent_sign_in_required' | 'not_signed_in' | 'notice_not_available' | 'files_remaining' | 'unknown'

const MESSAGES: Record<ErrorCode, string> = {
  recent_sign_in_required: 'For your child’s safety, please confirm with a fresh sign-in email first.',
  not_signed_in: 'Please sign in again to change cloud saving.',
  notice_not_available: 'This notice was just replaced. Reload the page to read the current version.',
  files_remaining:
    'Cloud saving is off, but some picture files are still being removed. Please try removing them again.',
  unknown: 'That didn’t go through. Please check your connection and try again.',
}

export class CloudConsentError extends Error {
  constructor(readonly code: ErrorCode) {
    super(MESSAGES[code])
  }
}

function toConsentError(error: { message?: string } | null): CloudConsentError {
  const message = error?.message ?? ''
  const known = (['recent_sign_in_required', 'not_signed_in', 'notice_not_available'] as const).find((code) =>
    message.includes(code),
  )
  if (!known) console.error('Cloud consent request failed', message)
  return new CloudConsentError(known ?? 'unknown')
}

async function fetchCloudConsentStatus([, userId]: readonly [string, string]): Promise<CloudConsentStatus> {
  const supabase = createClient()
  const [noticeResult, consentResult, claimsResult] = await Promise.all([
    supabase
      .from('consent_notices')
      .select('version, title, body, approved_at, retired_at')
      .eq('purpose', PURPOSE)
      .is('retired_at', null)
      .not('approved_at', 'is', null)
      .order('version', { ascending: false })
      .returns<NoticeRow[]>(),
    supabase
      .from('consent_records')
      .select('notice_version, given_at')
      .eq('parent_id', userId)
      .eq('purpose', PURPOSE)
      .is('withdrawn_at', null)
      .maybeSingle(),
    supabase.auth.getClaims(),
  ])

  if (noticeResult.error || consentResult.error) {
    console.error('Loading cloud saving status failed', noticeResult.error?.code ?? consentResult.error?.code)
    throw new Error('We couldn’t load cloud saving right now.')
  }

  const inForce = noticeResult.data
  const consent = consentResult.data
  const agreed = consent ? inForce.find((row) => row.version === consent.notice_version) : undefined

  return {
    notice: inForce[0] ? toNotice(inForce[0]) : null,
    consent: consent ? { noticeVersion: consent.notice_version, givenAt: new Date(consent.given_at) } : null,
    agreedNotice: agreed ? toNotice(agreed) : null,
    signedInAt: latestSignInAt(claimsResult.data?.claims?.amr),
  }
}

export function useCloudConsent(userId: string | null) {
  return useSWR(userId ? (['cloud-consent', userId] as const) : null, fetchCloudConsentStatus, {
    revalidateOnFocus: true,
  })
}

export async function giveCloudConsent(noticeVersion: number) {
  const { error } = await createClient().rpc('give_cloud_consent', { p_notice_version: noticeVersion })
  if (error) throw toConsentError(error)
}

/** Deletes every picture file in the parent's own storage folder. Safe to call again after a failure. */
export async function removeCloudFiles(userId: string) {
  const bucket = createClient().storage.from(ARTWORK_BUCKET)
  for (let round = 0; round < MAX_REMOVE_ROUNDS; round++) {
    const { data, error } = await bucket.list(userId, { limit: REMOVE_BATCH })
    if (error) throw new CloudConsentError('files_remaining')
    if (!data?.length) return
    const { error: removeError } = await bucket.remove(data.map((file) => `${userId}/${file.name}`))
    if (removeError) throw new CloudConsentError('files_remaining')
  }
  throw new CloudConsentError('files_remaining')
}

/** Withdraws consent and deletes the cloud rows in one database step, then clears the picture files. */
export async function disableCloudSaving(userId: string) {
  const { error } = await createClient().rpc('disable_cloud_saving')
  if (error) throw toConsentError(error)
  await removeCloudFiles(userId)
}
