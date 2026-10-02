import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MandalaArt } from '@/components/coloring/mandala-art'
import { EMPTY_FILLS } from '@/lib/artwork/library'
import { getMandala, latestVersion } from '@/lib/mandalas'
import { packPages } from '@/lib/packs'
import { loadOutline, peekOutline } from '@/lib/templates/outlines'

const sunny = latestVersion(getMandala('sunny')!)
const [tracedPage, otherTracedPage] = packPages('safari-garden')

describe('page outlines', () => {
  it('ship with the app for code-drawn pages, matching their areas', () => {
    const outline = peekOutline(sunny)!
    expect(outline.regions.map((r) => r.id)).toEqual(sunny.approvedRegionIds)
  })

  it('are fetched for a traced page only when asked for, once, matching its areas', async () => {
    const version = latestVersion(tracedPage)
    expect(peekOutline(version)).toBeNull()
    expect(peekOutline(latestVersion(otherTracedPage))).toBeNull()

    const requests = [loadOutline(version), loadOutline(version), loadOutline(version)]
    expect(new Set(requests).size).toBe(1)
    const outline = await requests[0]

    expect(outline.regions.map((r) => r.id)).toEqual(version.approvedRegionIds)
    expect(outline.regions.every((r) => r.d.length > 0)).toBe(true)
    expect(peekOutline(version)).toBe(outline)
    // Asking for one page never fetched another.
    expect(peekOutline(latestVersion(otherTracedPage))).toBeNull()
  })

  it('stay usable from server components, which reach them through lib/mandalas.ts', () => {
    // React hooks live in use-outline.ts; importing React here would break every server-rendered page.
    expect(readFileSync(join(__dirname, 'outlines.ts'), 'utf8')).not.toMatch(/from 'react'/)
  })

  it('refuse a page that has no outline', async () => {
    await expect(loadOutline({ templateId: 'no-such-page', version: 1 })).rejects.toThrow(/No outline/)
  })
})

describe('drawing a page', () => {
  it('knows the outlines that ship with the app before anything else has loaded the pages', async () => {
    // As in the browser when a server component hands a page to MandalaArt first.
    vi.resetModules()
    await import('@/lib/templates/use-outline')
    const { peekInlineOutline } = await import('@/lib/templates/outlines')
    expect(peekInlineOutline({ templateId: 'sunny', version: 1 })).not.toBeNull()
  })


  it('draws a code-drawn page straight away', () => {
    render(createElement(MandalaArt, { version: sunny, fills: EMPTY_FILLS, label: 'Sunny', onRegionTap: () => {} }))
    expect(screen.getAllByRole('button')).toHaveLength(sunny.regions.length)
  })

  it('holds a blank place for a traced page, then draws every area once its outline arrives', async () => {
    const version = latestVersion(otherTracedPage)
    render(createElement(MandalaArt, { version, fills: EMPTY_FILLS, label: otherTracedPage.name, onRegionTap: () => {} }))
    const art = screen.getByRole('group', { name: otherTracedPage.name })
    expect(art).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryAllByRole('button')).toHaveLength(0)

    expect(await screen.findAllByRole('button')).toHaveLength(version.regions.length)
    expect(art).not.toHaveAttribute('aria-busy')
    expect(screen.getByRole('button', { name: version.regions[0].label })).toBeInTheDocument()
  })
})
