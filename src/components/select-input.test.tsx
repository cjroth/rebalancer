import { describe, expect, test, afterEach } from 'bun:test'
import React from 'react'
import { renderTui, cleanup } from '../test-utils/index.ts'
import { SelectInput } from './select-input.tsx'
import type { SelectInputItem } from './select-input.tsx'

afterEach(() => {
  cleanup()
})

const items: SelectInputItem<string>[] = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

describe('SelectInput', () => {
  test('renders all items', async () => {
    const tui = renderTui(<SelectInput items={items} />)
    await tui.flush()
    expect(tui.screen.contains('Apple')).toBe(true)
    expect(tui.screen.contains('Banana')).toBe(true)
    expect(tui.screen.contains('Cherry')).toBe(true)
    tui.unmount()
  })

  test('first item is selected by default', async () => {
    const tui = renderTui(<SelectInput items={items} />)
    await tui.flush()
    // The indicator ▸ should appear
    expect(tui.screen.contains('▸')).toBe(true)
    tui.unmount()
  })

  test('arrow down moves highlight', async () => {
    let highlighted: SelectInputItem<string> | null = null
    const tui = renderTui(
      <SelectInput items={items} onHighlight={(item) => { highlighted = item }} />
    )
    await tui.flush()

    tui.keys.down()
    await tui.flush()

    expect(highlighted?.label).toBe('Banana')
    tui.unmount()
  })

  test('arrow up wraps to last item', async () => {
    let highlighted: SelectInputItem<string> | null = null
    const tui = renderTui(
      <SelectInput items={items} onHighlight={(item) => { highlighted = item }} />
    )
    await tui.flush()

    tui.keys.up()
    await tui.flush()

    expect(highlighted?.label).toBe('Cherry')
    tui.unmount()
  })

  test('Enter calls onSelect with current item', async () => {
    let selected: SelectInputItem<string> | null = null
    const tui = renderTui(
      <SelectInput items={items} onSelect={(item) => { selected = item }} />
    )
    await tui.flush()

    tui.keys.enter()
    await tui.flush()

    expect(selected?.label).toBe('Apple')
    expect(selected?.value).toBe('apple')
    tui.unmount()
  })

  test('Enter after navigating selects correct item', async () => {
    let selected: SelectInputItem<string> | null = null
    const tui = renderTui(
      <SelectInput items={items} onSelect={(item) => { selected = item }} />
    )
    await tui.flush()

    tui.keys.down()
    await tui.flush()
    tui.keys.down()
    await tui.flush()

    tui.keys.enter()
    await tui.flush()

    expect(selected?.label).toBe('Cherry')
    tui.unmount()
  })

  test('focus=false disables input', async () => {
    let selected: SelectInputItem<string> | null = null
    const tui = renderTui(
      <SelectInput items={items} focus={false} onSelect={(item) => { selected = item }} />
    )
    await tui.flush()

    tui.keys.enter()
    await tui.flush()

    expect(selected).toBe(null)
    tui.unmount()
  })

  test('initialIndex sets starting selection', async () => {
    let selected: SelectInputItem<string> | null = null
    const tui = renderTui(
      <SelectInput items={items} initialIndex={2} onSelect={(item) => { selected = item }} />
    )
    await tui.flush()

    tui.keys.enter()
    await tui.flush()

    expect(selected?.label).toBe('Cherry')
    tui.unmount()
  })

  test('j and k keys navigate like arrows', async () => {
    let highlighted: SelectInputItem<string> | null = null
    const tui = renderTui(
      <SelectInput items={items} onHighlight={(item) => { highlighted = item }} />
    )
    await tui.flush()

    tui.keys.press('j')
    await tui.flush()
    expect(highlighted?.label).toBe('Banana')

    tui.keys.press('k')
    await tui.flush()
    expect(highlighted?.label).toBe('Apple')

    tui.unmount()
  })
})
