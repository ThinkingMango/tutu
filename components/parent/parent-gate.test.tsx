import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ParentGate, newProblem } from '@/components/parent/parent-gate'
import { parentGateStore } from '@/lib/device-stores'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

beforeEach(() => replace.mockClear())

async function openGate() {
  const user = userEvent.setup()
  render(<ParentGate next="/parent/billing" />)
  const label = await screen.findByText(/^\d+ × \d+ 等于多少？$/)
  const [, a, b] = /(\d+) × (\d+)/.exec(label.textContent ?? '')!.map(Number)
  return { user, answer: a * b, input: screen.getByLabelText(/等于多少/) }
}

describe('parent gate', () => {
  it('asks a multiplication a young child can’t answer, from 12 × 3 up to 19 × 5', () => {
    expect(newProblem(() => 0)).toEqual({ a: 12, b: 3 })
    expect(newProblem(() => 0.9999)).toEqual({ a: 19, b: 5 })
    const answers = new Set<number>()
    for (let a = 12; a <= 19; a++) for (let b = 3; b <= 5; b++) answers.add(a * b)
    expect(answers.size).toBe(22)
  })

  it('has no press-and-hold button', async () => {
    await openGate()
    expect(screen.queryByRole('button', { name: /hold/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('stays shut and asks a new question after a wrong answer', async () => {
    const { user, answer, input } = await openGate()
    await user.type(input, String(answer + 1))
    await user.click(screen.getByRole('button', { name: '继续' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Not quite')
    expect(input).toHaveValue('')
    expect(parentGateStore.read()).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })

  it('stays shut when nothing is typed', async () => {
    const { user } = await openGate()
    await user.click(screen.getByRole('button', { name: '继续' }))
    expect(parentGateStore.read()).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })

  it('opens the grown-up area for the right answer', async () => {
    const { user, answer, input } = await openGate()
    await user.type(input, String(answer))
    await user.click(screen.getByRole('button', { name: '继续' }))
    expect(parentGateStore.read()).toBe(true)
    expect(replace).toHaveBeenCalledWith('/parent/billing')
  })
})
