import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GrownUpScriptGuard } from '@/components/kid/grown-up-script-guard'
import { isGrownUpDocument, markGrownUpDocument } from '@/lib/grown-up-scripts'

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__littleMandalaGrownUpScripts
})

describe('GrownUpScriptGuard', () => {
  it('shows the children’s screen on a fresh page', () => {
    render(<GrownUpScriptGuard>{<p>Let’s color!</p>}</GrownUpScriptGuard>)
    expect(screen.getByText('Let’s color!')).toBeInTheDocument()
  })

  it('shows nothing of the children’s screen on a page a grown-up page has used', () => {
    markGrownUpDocument()
    expect(isGrownUpDocument()).toBe(true)
    // jsdom can't navigate, so the reload itself only logs; what matters is that nothing renders.
    render(<GrownUpScriptGuard>{<p>Let’s color!</p>}</GrownUpScriptGuard>)
    expect(screen.queryByText('Let’s color!')).not.toBeInTheDocument()
  })
})
