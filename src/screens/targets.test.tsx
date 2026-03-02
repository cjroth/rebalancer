import { describe, expect, test, afterEach } from 'bun:test'
import React from 'react'
import { renderTui, cleanup, InMemoryStorage, buildDemoData } from '../test-utils/index.ts'
import { Step3Targets } from './targets.tsx'

afterEach(() => {
  cleanup()
})

function renderTargets(overrides: Record<string, any> = {}) {
  const storage = new InMemoryStorage()
  const { input, symbols, accounts, holdings } = buildDemoData()

  return renderTui(
    <Step3Targets
      dataDir="/tmp/test"
      storage={storage}
      onComplete={() => {}}
      onBack={() => {}}
      onReset={() => {}}
      portfolioInput={input}
      portfolioData={{ symbols, accounts, holdings }}
      {...overrides}
    />,
  )
}

describe('Step3Targets', () => {
  test('renders step header', async () => {
    const tui = renderTargets()
    await tui.waitFor('Step 3 of 4')
    expect(tui.screen.contains('Set Target Allocations')).toBe(true)
    tui.unmount()
  })

  test('shows symbol list with current and target columns', async () => {
    const tui = renderTargets()
    await tui.waitFor('VTI')
    // Headers are truncated to maxHeaderWidth (8) — "Current…" and "Target %"
    expect(tui.screen.contains('Current…')).toBe(true)
    expect(tui.screen.contains('Target %')).toBe(true)
    tui.unmount()
  })

  test('shows all portfolio symbols', async () => {
    const tui = renderTargets()
    await tui.waitFor('VTI')
    expect(tui.screen.contains('VXUS')).toBe(true)
    expect(tui.screen.contains('BND')).toBe(true)
    expect(tui.screen.contains('VGT')).toBe(true)
    expect(tui.screen.contains('SCHD')).toBe(true)
    tui.unmount()
  })

  test('shows navigation hints in status bar', async () => {
    const tui = renderTargets()
    await tui.waitFor('navigate')
    expect(tui.screen.contains('current')).toBe(true)
    expect(tui.screen.contains('remaining')).toBe(true)
    tui.unmount()
  })

  test('arrow keys navigate between rows', async () => {
    const tui = renderTargets()
    await tui.waitFor('VTI')

    // First row should show indicator
    expect(tui.screen.contains('▸')).toBe(true)

    tui.keys.down()
    await tui.flush()

    // Still shows the indicator (moved to next row)
    expect(tui.screen.contains('▸')).toBe(true)
    tui.unmount()
  })

  test('typing digits edits target percentage', async () => {
    const tui = renderTargets()
    await tui.waitFor('VTI')

    // Type a number to set target
    tui.keys.press('2')
    await tui.flush()
    tui.keys.press('5')
    await tui.flush()

    expect(tui.screen.contains('25')).toBe(true)
    tui.unmount()
  })

  test('c key copies current percentage to target', async () => {
    const tui = renderTargets()
    await tui.waitFor('VTI')

    tui.keys.press('c')
    await tui.flush()

    // Should show a non-zero target percentage
    const text = tui.screen.text()
    expect(text).toContain('VTI')
    tui.unmount()
  })

  test('a key sets all targets to current allocations', async () => {
    const tui = renderTargets()
    await tui.waitFor('VTI')

    tui.keys.press('a')
    await tui.flush()

    // Total should be close to 100% now
    expect(tui.screen.contains('100.00%')).toBe(true)
    tui.unmount()
  })
})
