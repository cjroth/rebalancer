import { describe, expect, test, afterEach } from 'bun:test'
import React from 'react'
import { renderTui, cleanup, InMemoryStorage, type TuiInstance } from '../test-utils/index.ts'
import { Step1Import } from './import.tsx'

afterEach(() => {
  cleanup()
})

function renderImport(overrides: Record<string, any> = {}) {
  const storage = new InMemoryStorage()
  return renderTui(
    <Step1Import
      dataDir="/tmp/test"
      storage={storage}
      onComplete={() => {}}
      readFile={(path: string) => {
        throw new Error(`readFile not implemented: ${path}`)
      }}
      {...overrides}
    />,
  )
}

describe('Step1Import', () => {
  test('renders step header and title', async () => {
    const tui = renderImport()
    await tui.waitFor('Import Portfolio')
    expect(tui.screen.contains('Step 1 of 4')).toBe(true)
    tui.unmount()
  })

  test('shows demo portfolio options', async () => {
    const tui = renderImport()
    await tui.waitFor('demo portfolio')
    expect(tui.screen.contains('Married couple, 30s')).toBe(true)
    expect(tui.screen.contains('Single, 20s')).toBe(true)
    expect(tui.screen.contains('Retiree, 60s')).toBe(true)
    tui.unmount()
  })

  test('selecting demo portfolio imports it', async () => {
    const tui = renderImport()
    await tui.waitFor('demo portfolio')

    tui.keys.enter()
    await tui.waitFor('Imported')

    expect(tui.screen.contains('15 holdings')).toBe(true)
    expect(tui.screen.contains('7 symbols')).toBe(true)
    expect(tui.screen.contains('5 accounts')).toBe(true)
    tui.unmount()
  })

  test('shows file path input placeholder in terminal mode', async () => {
    const tui = renderImport()
    await tui.flush()
    expect(tui.screen.contains('Paste or drag a CSV file path')).toBe(true)
    tui.unmount()
  })

  test('shows drag and drop placeholder in browser mode', async () => {
    const storage = new InMemoryStorage()
    const tui = renderTui(
      <Step1Import
        dataDir="/tmp/test"
        storage={storage}
        onComplete={() => {}}
      />,
    )
    await tui.flush()
    expect(tui.screen.contains('Drag and drop a CSV file')).toBe(true)
    tui.unmount()
  })

  test('shows import summary after successful import', async () => {
    const tui = renderImport()
    await tui.waitFor('demo portfolio')

    tui.keys.enter()
    await tui.waitFor('Imported')

    expect(tui.screen.contains('$335,948.60')).toBe(true)
    expect(tui.screen.contains('continue')).toBe(true)
    tui.unmount()
  })

  test('calls onComplete when pressing Enter after import', async () => {
    let completed = false
    const tui = renderImport({ onComplete: () => { completed = true } })
    await tui.waitFor('demo portfolio')

    tui.keys.enter()
    await tui.waitFor('Imported')

    tui.keys.enter()
    await tui.flush()

    expect(completed).toBe(true)
    tui.unmount()
  })

  test('can navigate between demo options', async () => {
    const tui = renderImport()
    await tui.waitFor('demo portfolio')

    tui.keys.down()
    await tui.flush()
    tui.keys.enter()
    await tui.waitFor('Imported demo (Single, 20s)')

    expect(tui.screen.contains('5 symbols')).toBe(true)
    tui.unmount()
  })
})
