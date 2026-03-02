import { describe, expect, test, afterEach } from 'bun:test'
import React, { useState } from 'react'
import { renderTui, cleanup, type TuiInstance } from '../test-utils/index.ts'
import { TextInput } from './text-input.tsx'

afterEach(() => {
  cleanup()
})

/** Type characters one at a time with flush between each to avoid React batching issues */
async function typeSlowly(tui: TuiInstance, text: string) {
  for (const char of text) {
    tui.keys.press(char)
    await tui.flush()
  }
}

function ControlledTextInput({ onSubmit }: { onSubmit?: (value: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <TextInput
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      placeholder="Type here..."
    />
  )
}

describe('TextInput', () => {
  test('shows placeholder when empty', async () => {
    const tui = renderTui(<ControlledTextInput />)
    await tui.flush()
    expect(tui.screen.contains('Type here...')).toBe(true)
    tui.unmount()
  })

  test('typing appends characters', async () => {
    const tui = renderTui(<ControlledTextInput />)
    await tui.flush()

    await typeSlowly(tui, 'hello')

    expect(tui.screen.contains('hello')).toBe(true)
    expect(tui.screen.contains('Type here...')).toBe(false)
    tui.unmount()
  })

  test('backspace deletes last character', async () => {
    const tui = renderTui(<ControlledTextInput />)
    await tui.flush()

    await typeSlowly(tui, 'abc')
    expect(tui.screen.contains('abc')).toBe(true)

    tui.keys.backspace()
    await tui.flush()
    expect(tui.screen.contains('ab')).toBe(true)
    tui.unmount()
  })

  test('Enter submits value', async () => {
    let submitted = ''
    const tui = renderTui(
      <ControlledTextInput onSubmit={(v) => { submitted = v }} />
    )
    await tui.flush()

    await typeSlowly(tui, 'test')
    expect(tui.screen.contains('test')).toBe(true)

    tui.keys.enter()
    await tui.flush()

    expect(submitted).toBe('test')
    tui.unmount()
  })

  test('Enter on empty value does not submit', async () => {
    let submitted = false
    const tui = renderTui(
      <ControlledTextInput onSubmit={() => { submitted = true }} />
    )
    await tui.flush()

    tui.keys.enter()
    await tui.flush()

    expect(submitted).toBe(false)
    tui.unmount()
  })

  test('shows prompt character', async () => {
    const tui = renderTui(<TextInput prompt="> " />)
    await tui.flush()
    expect(tui.screen.contains('>')).toBe(true)
    tui.unmount()
  })

  test('focus=false hides cursor and ignores input', async () => {
    const tui = renderTui(<TextInput focus={false} placeholder="No input" />)
    await tui.flush()
    expect(tui.screen.contains('No input')).toBe(true)
    tui.unmount()
  })

  test('uncontrolled mode works without value/onChange', async () => {
    let submitted = ''
    const tui = renderTui(
      <TextInput onSubmit={(v) => { submitted = v }} placeholder="Uncontrolled" />
    )
    await tui.flush()

    await typeSlowly(tui, 'works')
    expect(tui.screen.contains('works')).toBe(true)

    tui.keys.enter()
    await tui.flush()
    expect(submitted).toBe('works')
    tui.unmount()
  })
})
