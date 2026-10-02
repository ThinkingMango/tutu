export const DELETION_ERRORS = [
  'recent_sign_in_required',
  'not_signed_in',
  'confirmation_mismatch',
  'active_plan',
  'forbidden',
  'unknown',
] as const

export type DeletionErrorCode = (typeof DELETION_ERRORS)[number]

const MESSAGES: Record<DeletionErrorCode, string> = {
  recent_sign_in_required: 'For your child’s safety, please confirm with a fresh sign-in email first.',
  not_signed_in: 'Please sign in again to delete your account.',
  confirmation_mismatch: 'The email address you typed doesn’t match this account.',
  active_plan: 'A subscription on this account is still active. Email support@smartmango.ai and we’ll cancel it first.',
  forbidden: 'That request was blocked. Please reload the page and try again.',
  unknown: 'Your account wasn’t deleted. Please check your connection and try again.',
}

export class AccountDeletionError extends Error {
  constructor(readonly code: DeletionErrorCode) {
    super(MESSAGES[code])
  }
}

export async function deleteAccount(confirmEmail: string) {
  let response: Response
  try {
    response = await fetch('/api/account', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmEmail }),
    })
  } catch {
    throw new AccountDeletionError('unknown')
  }
  if (response.ok) return
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null
  const code = DELETION_ERRORS.find((known) => known === body?.error) ?? 'unknown'
  throw new AccountDeletionError(code)
}
