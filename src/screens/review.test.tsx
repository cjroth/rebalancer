import { describe, expect, test, afterEach } from 'bun:test'
import React from 'react'
import { renderTui, cleanup, InMemoryStorage, buildDemoData } from '../test-utils/index.ts'
import { Step2Review } from './review.tsx'

afterEach(() => {
  cleanup()
})

function renderReview() {
  const storage = new InMemoryStorage()
  const { symbols, accounts, holdings } = buildDemoData()

  return renderTui(
    <Step2Review
      dataDir="/tmp/test"
      storage={storage}
      onComplete={() => {}}
      onBack={() => {}}
      onReset={() => {}}
      portfolioData={{ symbols, accounts, holdings }}
    />,
  )
}

describe('Step2Review', () => {
  test('renders step header', async () => {
    const tui = renderReview()
    await tui.waitFor('Step 2 of 4')
    expect(tui.screen.contains('Review Current Positions')).toBe(true)
    tui.unmount()
  })

  test('shows portfolio symbols', async () => {
    const tui = renderReview()
    await tui.waitFor('VTI')
    expect(tui.screen.contains('VTI')).toBe(true)
    expect(tui.screen.contains('VXUS')).toBe(true)
    expect(tui.screen.contains('SCHD')).toBe(true)
    tui.unmount()
  })

  test('shows account names in column headers', async () => {
    const tui = renderReview()
    await tui.waitFor('VTI')
    // Account names are truncated to maxHeaderWidth (8) with …
    expect(tui.screen.contains('Alex_40…')).toBe(true)
    expect(tui.screen.contains('Sam_401k')).toBe(true)
    tui.unmount()
  })

  test('shows portfolio totals', async () => {
    const tui = renderReview()
    await tui.waitFor('VTI')
    // Grand total should be visible
    expect(tui.screen.contains('$335,948')).toBe(true)
    tui.unmount()
  })
})
