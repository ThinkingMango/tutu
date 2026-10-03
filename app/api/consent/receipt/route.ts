import { NextResponse, type NextRequest } from 'next/server'
import {
  buildConsentReceiptPdf,
  receiptFileName,
  resolveTimeZone,
  signedInAtFromReference,
  type ReceiptRecord,
} from '@/lib/cloud-consent/receipt'
import { createClient } from '@/lib/supabase/server'

const PURPOSE = 'cloud_artwork_sync'
const HISTORY_LIMIT = 50

type ConsentRow = {
  id: string
  notice_version: number
  verification_reference: string
  given_at: string
  withdrawn_at: string | null
}

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

function toRecord(row: ConsentRow): ReceiptRecord {
  return {
    id: row.id,
    noticeVersion: row.notice_version,
    givenAt: new Date(row.given_at),
    withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at) : null,
    signedInAt: signedInAtFromReference(row.verification_reference),
  }
}

/**
 * The signed-in parent's cloud saving permission as a PDF: the active consent record, the exact
 * notice version it points at, and earlier permissions. Reads with the parent's own session, so
 * row-level security limits it to their records.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (!claims?.sub) return fail('not_signed_in', 401)

  const { data: rows, error } = await supabase
    .from('consent_records')
    .select('id, notice_version, verification_reference, given_at, withdrawn_at')
    .eq('parent_id', claims.sub)
    .eq('purpose', PURPOSE)
    .order('given_at', { ascending: false })
    .limit(HISTORY_LIMIT)
    .returns<ConsentRow[]>()
  if (error) {
    console.error('Loading consent records for the receipt failed', error.code)
    return fail('unavailable', 500)
  }

  const active = rows.find((row) => !row.withdrawn_at)
  if (!active) return fail('no_active_permission', 404)

  const { data: notice, error: noticeError } = await supabase
    .from('consent_notices')
    .select('version, title, body, approved_at, body_sha256')
    .eq('version', active.notice_version)
    .maybeSingle()
  if (noticeError || !notice?.approved_at) {
    console.error('Loading the agreed notice for the receipt failed', noticeError?.code ?? 'missing')
    return fail('unavailable', 500)
  }

  const timeZone = resolveTimeZone(request.nextUrl.searchParams.get('tz'))
  const record = toRecord(active)
  const pdf = await buildConsentReceiptPdf({
    parentEmail: typeof claims.email === 'string' && claims.email ? claims.email : '您的家长账户',
    record,
    notice: {
      version: notice.version,
      title: notice.title,
      body: notice.body,
      approvedAt: new Date(notice.approved_at),
      sha256: notice.body_sha256,
    },
    history: rows.map(toRecord),
    generatedAt: new Date(),
    timeZone,
  })

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${receiptFileName(record.givenAt, timeZone)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
