import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FreshSignInPrompt } from '@/components/parent/fresh-sign-in-prompt'
import { SignInForm } from '@/components/parent/sign-in-form'

const { sendEmailLink, verifyEmailCode, replace, refreshRecentSignIn } = vi.hoisted(() => ({
  sendEmailLink: vi.fn(),
  verifyEmailCode: vi.fn(),
  replace: vi.fn(),
  refreshRecentSignIn: vi.fn(),
}))

vi.mock('@/lib/auth/client', () => ({
  authClient: { sendEmailLink, verifyEmailCode },
  useAuthState: () => ({ status: 'signed-out', user: null }),
}))
vi.mock('@/lib/auth/recent-sign-in', () => ({ refreshRecentSignIn }))
vi.mock('@/components/parent/sign-out-button', () => ({ SignOutButton: () => null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

beforeEach(() => {
  for (const mock of [sendEmailLink, verifyEmailCode, replace, refreshRecentSignIn]) mock.mockReset()
  sendEmailLink.mockResolvedValue(undefined)
})

describe('sign-in page', () => {
  it('signs this device in with the code from the email, then goes on', async () => {
    verifyEmailCode.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<SignInForm next="/parent/cloud-saving" linkError={null} />)

    await user.type(screen.getByLabelText('Email'), 'parent@example.com')
    await user.click(screen.getByRole('button', { name: /Email me a sign-in link/ }))
    expect(await screen.findByText(/sign-in link and code/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Type the code from it/), '482913')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(verifyEmailCode).toHaveBeenCalledWith('parent@example.com', '482913')
    expect(replace).toHaveBeenCalledWith('/parent/cloud-saving')
  })

  it('stays put and explains when the code is wrong', async () => {
    verifyEmailCode.mockRejectedValue(new Error('That code didn’t work.'))
    const user = userEvent.setup()
    render(<SignInForm next="/parent/home" linkError={null} />)

    await user.type(screen.getByLabelText('Email'), 'parent@example.com')
    await user.click(screen.getByRole('button', { name: /Email me a sign-in link/ }))
    await user.type(await screen.findByLabelText(/Type the code from it/), '000000')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That code didn’t work.')
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('fresh sign-in before cloud saving or deleting the account', () => {
  it('offers the code only after the email is sent, and unlocks the page after a right code', async () => {
    verifyEmailCode.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<FreshSignInPrompt email="parent@example.com" action="turn on cloud saving" returnPath="/parent/cloud-saving" />)

    expect(screen.queryByLabelText(/Type the code from it/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Email me a link and code' }))
    expect(sendEmailLink).toHaveBeenCalledWith('parent@example.com', '/parent/cloud-saving')

    await user.type(await screen.findByLabelText(/Type the code from it/), '482913')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(verifyEmailCode).toHaveBeenCalledWith('parent@example.com', '482913')
    expect(refreshRecentSignIn).toHaveBeenCalled()
  })
})
