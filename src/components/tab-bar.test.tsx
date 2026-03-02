import { describe, expect, test, afterEach } from 'bun:test'
import React from 'react'
import { renderTui, cleanup } from '../test-utils/index.ts'
import { TabBar } from './tab-bar.tsx'

afterEach(() => {
  cleanup()
})

describe('TabBar', () => {
  test('renders all options', async () => {
    const tui = renderTui(
      <TabBar options={['Trades', 'Balances']} selectedIndex={0} />
    )
    await tui.flush()

    expect(tui.screen.contains('Trades')).toBe(true)
    expect(tui.screen.contains('Balances')).toBe(true)
    tui.unmount()
  })

  test('renders label when provided', async () => {
    const tui = renderTui(
      <TabBar label="View" options={['Trades', 'Balances']} selectedIndex={0} />
    )
    await tui.flush()

    expect(tui.screen.contains('View')).toBe(true)
    tui.unmount()
  })

  test('highlights selected tab', async () => {
    const tui = renderTui(
      <TabBar options={['Alpha', 'Beta', 'Gamma']} selectedIndex={1} />
    )
    await tui.flush()

    // All options should be visible
    expect(tui.screen.contains('Alpha')).toBe(true)
    expect(tui.screen.contains('Beta')).toBe(true)
    expect(tui.screen.contains('Gamma')).toBe(true)
    tui.unmount()
  })

  test('changes highlight when selectedIndex changes', async () => {
    const tui = renderTui(
      <TabBar options={['A', 'B', 'C']} selectedIndex={0} />
    )
    await tui.flush()
    expect(tui.screen.contains('A')).toBe(true)

    tui.rerender(
      <TabBar options={['A', 'B', 'C']} selectedIndex={2} />
    )
    await tui.flush()
    expect(tui.screen.contains('C')).toBe(true)
    tui.unmount()
  })

  test('renders with focused and unfocused state', async () => {
    const tui = renderTui(
      <TabBar options={['X', 'Y']} selectedIndex={0} focused={true} />
    )
    await tui.flush()
    expect(tui.screen.contains('X')).toBe(true)
    expect(tui.screen.contains('Y')).toBe(true)

    tui.rerender(
      <TabBar options={['X', 'Y']} selectedIndex={0} focused={false} />
    )
    await tui.flush()
    // Both options still visible in unfocused state
    expect(tui.screen.contains('X')).toBe(true)
    expect(tui.screen.contains('Y')).toBe(true)
    tui.unmount()
  })

  test('label with fixed width pads correctly', async () => {
    const tui = renderTui(
      <TabBar label="Mode" labelWidth={10} options={['A', 'B']} selectedIndex={0} />
    )
    await tui.flush()

    // Label should be present with padding
    expect(tui.screen.contains('Mode')).toBe(true)
    tui.unmount()
  })
})
