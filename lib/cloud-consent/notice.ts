/** Must match private.require_recent_sign_in() in the database. */
export const CONSENT_WINDOW_MS = 10 * 60 * 1000

/** Stop offering the button a little early so a slow click doesn't land just past the server's cutoff. */
const SAFETY_MARGIN_MS = 30 * 1000

export type NoticeSection = { heading: string | null; paragraphs: string[] }

/**
 * What changed in each notice version, shown to parents whose permission is on an earlier version
 * that is still in force. Only list versions that don't need parents to agree again; a change that
 * does should retire the older version instead.
 */
export const NOTICE_CHANGES: Partial<Record<number, string>> = {
  2: '如需获取数据副本，现在请发送邮件给我们，而不是在此处下载。我们保存的内容以及可查看的人员均未改变。',
}

/** The exact sentence the parent ticks. The permission record PDF quotes it word for word. */
export function agreementStatement(noticeVersion: number) {
  return `我是此孩子的父母或法定监护人。我已阅读上方第 ${noticeVersion} 版告知，并同意按其所述开启云端保存。`
}

/** The approved notice is stored as "## Heading" lines followed by one paragraph per line. */
export function parseNoticeSections(body: string): NoticeSection[] {
  const sections: NoticeSection[] = []
  let current: NoticeSection | null = null

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), paragraphs: [] }
      sections.push(current)
      continue
    }
    if (!current) {
      current = { heading: null, paragraphs: [] }
      sections.push(current)
    }
    current.paragraphs.push(line)
  }

  return sections
}

/** Latest sign-in time from a verified token's `amr` claim, the same source the database checks. */
export function latestSignInAt(amr: unknown): Date | null {
  if (!Array.isArray(amr)) return null
  let latest = 0
  for (const entry of amr) {
    const timestamp = (entry as { timestamp?: unknown } | null)?.timestamp
    if (typeof timestamp === 'number' && Number.isFinite(timestamp)) latest = Math.max(latest, timestamp)
  }
  return latest > 0 ? new Date(latest * 1000) : null
}

/** Milliseconds left to give or withdraw consent with the current sign-in; 0 when a fresh link is needed. */
export function freshSignInRemainingMs(signedInAt: Date | null, now: number): number {
  if (!signedInAt) return 0
  return Math.max(0, signedInAt.getTime() + CONSENT_WINDOW_MS - SAFETY_MARGIN_MS - now)
}
