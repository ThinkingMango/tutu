import { useEffect, useState } from 'react'

/** The current time, refreshed every `intervalMs`, for countdowns like the fresh sign-in window. */
export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
