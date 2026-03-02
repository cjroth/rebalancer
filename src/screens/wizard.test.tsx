import { describe, expect, test, afterEach } from 'bun:test'
import React from 'react'
import { renderTui, cleanup, InMemoryStorage } from '../test-utils/index.ts'
import { Wizard } from './wizard.tsx'

afterEach(() => {
  cleanup()
})

function renderWizard() {
  const storage = new InMemoryStorage()
  return renderTui(
    <Wizard
      dataDir="/tmp/test"
      storage={storage}
      initialStep={1}
      readFile={(path: string) => {
        throw new Error(`readFile not implemented in test: ${path}`)
      }}
    />,
  )
}

describe('Rebalance Wizard', () => {
  test('renders step 1 with demo portfolios', async () => {
    const tui = renderWizard()
    await tui.waitFor('Import Portfolio')
    expect(tui.screen.contains('Married couple, 30s')).toBe(true)
    expect(tui.screen.contains('Single, 20s')).toBe(true)
    expect(tui.screen.contains('Retiree, 60s')).toBe(true)
    tui.unmount()
  })

  test('selects a demo portfolio and imports it', async () => {
    const tui = renderWizard()
    await tui.waitFor('demo portfolio')

    tui.keys.enter()
    await tui.waitFor('Imported')

    expect(tui.screen.contains('15 holdings')).toBe(true)
    expect(tui.screen.contains('7 symbols')).toBe(true)
    expect(tui.screen.contains('5 accounts')).toBe(true)
    expect(tui.screen.contains('$335,948.60')).toBe(true)
    tui.unmount()
  })

  test('navigates to step 2 (review)', async () => {
    const tui = renderWizard()
    await tui.waitFor('demo portfolio')

    tui.keys.enter()
    await tui.waitFor('Imported')

    tui.keys.enter()
    await tui.waitFor('Step 2')

    expect(tui.screen.contains('Review Current Positions')).toBe(true)
    expect(tui.screen.contains('VTI')).toBe(true)
    expect(tui.screen.contains('SCHD')).toBe(true)
    tui.unmount()
  })

  test('navigates to step 3 (targets)', async () => {
    const tui = renderWizard()
    await tui.waitFor('demo portfolio')

    tui.keys.enter()
    await tui.waitFor('continue')

    tui.keys.enter()
    await tui.waitFor('Step 2')

    tui.keys.enter()
    await tui.waitFor('Step 3')

    expect(tui.screen.contains('Set Target Allocations')).toBe(true)
    expect(tui.screen.contains('VTI')).toBe(true)
    expect(tui.screen.contains('Target %')).toBe(true)
    tui.unmount()
  })

  test('selects second demo with arrow key', async () => {
    const tui = renderWizard()
    await tui.waitFor('demo portfolio')

    tui.keys.down()
    await tui.flush()
    tui.keys.enter()
    await tui.waitFor('Imported demo (Single, 20s)')

    expect(tui.screen.contains('5 symbols')).toBe(true)
    expect(tui.screen.contains('3 accounts')).toBe(true)
    tui.unmount()
  })

  test('full wizard flow: step 1 → 2 → 3 → 4', async () => {
    const tui = renderWizard()

    // Step 1: Import
    await tui.waitFor('Step 1')
    tui.keys.enter()
    await tui.waitFor('Imported')
    tui.keys.enter()

    // Step 2: Review
    await tui.waitFor('Step 2')
    expect(tui.screen.contains('Review Current Positions')).toBe(true)
    tui.keys.enter()

    // Step 3: Targets
    await tui.waitFor('Step 3')
    expect(tui.screen.contains('Set Target Allocations')).toBe(true)
    tui.keys.enter()

    // Step 4: Trades
    await tui.waitFor('Step 4')
    expect(tui.screen.contains('Review Trades')).toBe(true)

    tui.unmount()
  })
})
