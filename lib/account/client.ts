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
  recent_sign_in_required: '为了孩子的安全，请先通过新的登录邮件确认身份。',
  not_signed_in: '请重新登录后再删除账户。',
  confirmation_mismatch: '你输入的邮箱地址与此账户不符。',
  active_plan: '此账户仍有有效的订阅。请发送邮件至 support@smartmango.ai，我们会先为你取消。',
  forbidden: '该请求已被拦截。请刷新页面后重试。',
  unknown: '账户未删除。请检查网络连接后重试。',
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
