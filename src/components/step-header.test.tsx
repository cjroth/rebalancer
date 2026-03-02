import { describe, expect, test, afterEach } from 'bun:test'
import React from 'react'
import { renderTui, cleanup } from '../test-utils/index.ts'
import { StepHeader } from './step-header.tsx'

afterEach(() => {
  cleanup()
})

describe('StepHeader', () => {
  test('renders step number and total', async () => {
    const tui = renderTui(
      <StepHeader step={1} totalSteps={4} title="Import Portfolio" description="" />
    )
    await tui.flush()

    expect(tui.screen.contains('Step 1 of 4')).toBe(true)
    tui.unmount()
  })

  test('renders title', async () => {
    const tui = renderTui(
      <StepHeader step={2} totalSteps={4} title="Review Current Positions" description="" />
    )
    await tui.flush()

    expect(tui.screen.contains('Review Current Positions')).toBe(true)
    tui.unmount()
  })

  test('renders description text', async () => {
    const tui = renderTui(
      <StepHeader
        step={1}
        totalSteps={4}
        title="Import"
        description="Upload your portfolio CSV file to begin"
      />
    )
    await tui.flush()

    expect(tui.screen.contains('Upload your portfolio')).toBe(true)
    tui.unmount()
  })

  test('renders box drawing borders', async () => {
    const tui = renderTui(
      <StepHeader step={1} totalSteps={4} title="Test" description="" />
    )
    await tui.flush()

    expect(tui.screen.contains('╭')).toBe(true)
    expect(tui.screen.contains('╰')).toBe(true)
    expect(tui.screen.contains('│')).toBe(true)
    tui.unmount()
  })

  test('renders different step numbers', async () => {
    for (const step of [1, 2, 3, 4]) {
      const tui = renderTui(
        <StepHeader step={step} totalSteps={4} title={`Step ${step} Title`} description="" />
      )
      await tui.flush()
      expect(tui.screen.contains(`Step ${step} of 4`)).toBe(true)
      tui.unmount()
    }
  })

  test('wraps long description text', async () => {
    const longDesc = 'This is a very long description that should wrap to multiple lines because it exceeds the maximum width of the step header component box'
    const tui = renderTui(
      <StepHeader step={1} totalSteps={4} title="Test" description={longDesc} />
    )
    await tui.flush()

    // Should contain parts of the description
    expect(tui.screen.contains('This is a very long')).toBe(true)
    tui.unmount()
  })
})
