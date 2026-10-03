export const OPERATOR_NAME = 'SmartMango'
export const SUPPORT_EMAIL = 'support@smartmango.ai'
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`
export const REFUND_WINDOW_DAYS = 14
export const POLICIES_UPDATED = '1 October 2026'

export const PRIVACY_HREF = '/privacy'
export const REFUNDS_HREF = '/refunds'
export const SUPPORT_HREF = '/support'

export const INFO_LINKS = [
  { href: PRIVACY_HREF, label: 'Privacy' },
  { href: REFUNDS_HREF, label: 'Refunds' },
  { href: SUPPORT_HREF, label: '帮助与支持' },
] as const

export function supportMailto(subject: string) {
  return `${SUPPORT_MAILTO}?subject=${encodeURIComponent(subject)}`
}
