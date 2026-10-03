import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authClient, normalizeEmailCode } from '@/lib/auth/client'

const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { verifyOtp, onAuthStateChange: () => ({ data: { subscription: {} } }) } }),
}))

beforeEach(() => verifyOtp.mockReset())

describe('signing in with the emailed code', () => {
  it('ignores spaces and dashes people type or paste', () => {
    expect(normalizeEmailCode(' 482 913 ')).toBe('482913')
    expect(normalizeEmailCode('482-913')).toBe('482913')
  })

  it('checks the code with Supabase as an email sign-in', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    await authClient.verifyEmailCode(' Parent@Example.com ', '482 913')
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'parent@example.com', token: '482913', type: 'email' })
  })

  it('refuses anything that isn’t a 6 to 10 digit code without asking Supabase', async () => {
    for (const code of ['', '12345', 'abcdef', '12345678901']) {
      await expect(authClient.verifyEmailCode('parent@example.com', code)).rejects.toThrow('Type the number code')
    }
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('explains a wrong or expired code', async () => {
    verifyOtp.mockResolvedValue({ error: { code: 'otp_expired', status: 403, message: 'Token has expired or is invalid' } })
    await expect(authClient.verifyEmailCode('parent@example.com', '000000')).rejects.toThrow('验证码无效')
  })

  it('asks people to slow down after too many tries', async () => {
    verifyOtp.mockResolvedValue({ error: { code: 'over_request_rate_limit', status: 429, message: 'Too many' } })
    await expect(authClient.verifyEmailCode('parent@example.com', '000000')).rejects.toThrow('尝试次数过多')
  })
})
