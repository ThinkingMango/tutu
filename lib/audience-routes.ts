/** Pages written for grown-ups. Everything else, including the parent gate at `/parent`, is treated as a child's screen. */
const GROWN_UP_PAGES = ['/privacy', '/refunds', '/support'] as const

export function isGrownUpPath(pathname: string) {
  if (pathname.startsWith('/parent/')) return true
  return GROWN_UP_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))
}

/** Visit statistics are only sent for grown-up pages, whatever page loaded the script first. */
export function grownUpEventsOnly<T extends { url: string }>(event: T): T | null {
  try {
    return isGrownUpPath(new URL(event.url).pathname) ? event : null
  } catch {
    return null
  }
}
