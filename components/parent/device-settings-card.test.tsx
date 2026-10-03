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

    await user.click(screen.getByRole('button', { name: '清除已保存的涂色' }))
    const clear = await screen.findByRole('button', { name: '全部清除' })
    expect(clear).toBeDisabled()

    const confirm = screen.getByLabelText('输入“清除”以确认')
    await user.type(confirm, '清')
    expect(clear).toBeDisabled()

    await user.type(confirm, '除')
    expect(clear).toBeEnabled()
    await user.click(clear)

    expect(await screen.findByText('已全部清除')).toBeInTheDocument()
    expect(window.localStorage.getItem(STORAGE_KEYS.gallery)).toBeNull()
  })
})
