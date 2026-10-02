import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DeviceSettingsCard } from '@/components/parent/device-settings-card'
import { STORAGE_KEYS } from '@/lib/artwork/library'

describe('clearing saved coloring', () => {
  it('only clears after CLEAR is typed', async () => {
    window.localStorage.setItem(STORAGE_KEYS.gallery, JSON.stringify(['art_00000000-0000-4000-8000-000000000000']))
    const user = userEvent.setup()
    render(<DeviceSettingsCard />)

    await user.click(screen.getByRole('button', { name: 'Clear saved coloring' }))
    const clear = await screen.findByRole('button', { name: 'Clear everything' })
    expect(clear).toBeDisabled()

    const confirm = screen.getByLabelText('Type CLEAR to confirm')
    await user.type(confirm, 'clea')
    expect(clear).toBeDisabled()

    await user.type(confirm, 'r')
    expect(clear).toBeEnabled()
    await user.click(clear)

    expect(await screen.findByText('All clear')).toBeInTheDocument()
    expect(window.localStorage.getItem(STORAGE_KEYS.gallery)).toBeNull()
  })
})
