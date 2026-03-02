import { describe, expect, test, afterEach } from 'bun:test'
import React from 'react'
import { Text } from 'ink'
import { renderTui, cleanup } from '../test-utils/index.ts'
import { StatusBar } from './status-bar.tsx'

afterEach(() => {
  cleanup()
})

describe('StatusBar', () => {
  test('renders keybinding hints', async () => {
    const tui = renderTui(
      <StatusBar items={[
        { key: 'Tab', label: 'switch focus' },
        { key: 'q', label: 'quit' },
      ]} />
    )
    await tui.flush()

    expect(tui.screen.contains('Tab')).toBe(true)
    expect(tui.screen.contains('switch focus')).toBe(true)
    expect(tui.screen.contains('q')).toBe(true)
    expect(tui.screen.contains('quit')).toBe(true)
    tui.unmount()
  })

  test('renders extra content before items', async () => {
    const extra = <Text color="green">$100,000</Text>
    const tui = renderTui(
      <StatusBar
        items={[{ key: '⏎', label: 'continue' }]}
        extra={extra}
      />
    )
    await tui.flush()

    expect(tui.screen.contains('$100,000')).toBe(true)
    expect(tui.screen.contains('continue')).toBe(true)
    // Separator should appear between extra and items
    expect(tui.screen.contains('│')).toBe(true)
    tui.unmount()
  })

  test('renders without extra content', async () => {
    const tui = renderTui(
      <StatusBar items={[{ key: 'b', label: 'back' }]} />
    )
    await tui.flush()

    expect(tui.screen.contains('b')).toBe(true)
    expect(tui.screen.contains('back')).toBe(true)
    tui.unmount()
  })

  test('renders multiple items', async () => {
    const tui = renderTui(
      <StatusBar items={[
        { key: '↑↓', label: 'navigate' },
        { key: '←→', label: 'change' },
        { key: 'b', label: 'back' },
        { key: 'z', label: 'reset' },
        { key: '⏎', label: 'continue' },
      ]} />
    )
    await tui.flush()

    expect(tui.screen.contains('navigate')).toBe(true)
    expect(tui.screen.contains('change')).toBe(true)
    expect(tui.screen.contains('back')).toBe(true)
    expect(tui.screen.contains('reset')).toBe(true)
    expect(tui.screen.contains('continue')).toBe(true)
    tui.unmount()
  })

  test('updates when items change', async () => {
    const tui = renderTui(
      <StatusBar items={[{ key: 'a', label: 'action1' }]} />
    )
    await tui.flush()
    expect(tui.screen.contains('action1')).toBe(true)

    tui.rerender(
      <StatusBar items={[{ key: 'b', label: 'action2' }]} />
    )
    await tui.flush()
    expect(tui.screen.contains('action2')).toBe(true)
    expect(tui.screen.contains('action1')).toBe(false)
    tui.unmount()
  })
})
