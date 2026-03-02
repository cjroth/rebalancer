import { describe, expect, test, afterEach } from 'bun:test'
import React from 'react'
import { renderTui, cleanup } from '../test-utils/index.ts'
import { Table } from './table.tsx'
import type { Column, Cell } from './table.tsx'

afterEach(() => {
  cleanup()
})

describe('Table', () => {
  test('renders simple data table with headers', async () => {
    const data = [
      { name: 'VTI', shares: '100', price: '$250' },
      { name: 'VXUS', shares: '200', price: '$60' },
    ]
    const tui = renderTui(<Table data={data} />)
    await tui.flush()

    expect(tui.screen.contains('name')).toBe(true)
    expect(tui.screen.contains('shares')).toBe(true)
    expect(tui.screen.contains('price')).toBe(true)
    expect(tui.screen.contains('VTI')).toBe(true)
    expect(tui.screen.contains('VXUS')).toBe(true)
    expect(tui.screen.contains('100')).toBe(true)
    expect(tui.screen.contains('200')).toBe(true)
    tui.unmount()
  })

  test('renders advanced table with custom columns', async () => {
    const columns: Column[] = [
      { header: 'Symbol', align: 'left' },
      { header: 'Amount', align: 'right' },
    ]
    const rows: Cell[][] = [
      [{ text: 'VTI' }, { text: '$25,000' }],
      [{ text: 'VXUS' }, { text: '$12,000' }],
    ]
    const tui = renderTui(<Table columns={columns} rows={rows} />)
    await tui.flush()

    expect(tui.screen.contains('Symbol')).toBe(true)
    expect(tui.screen.contains('Amount')).toBe(true)
    expect(tui.screen.contains('VTI')).toBe(true)
    expect(tui.screen.contains('$25,000')).toBe(true)
    tui.unmount()
  })

  test('renders box drawing borders', async () => {
    const data = [{ col: 'val' }]
    const tui = renderTui(<Table data={data} />)
    await tui.flush()

    expect(tui.screen.contains('╭')).toBe(true)
    expect(tui.screen.contains('╰')).toBe(true)
    expect(tui.screen.contains('│')).toBe(true)
    expect(tui.screen.contains('─')).toBe(true)
    tui.unmount()
  })

  test('renders footer rows with separator', async () => {
    const columns: Column[] = [
      { header: 'Item' },
      { header: 'Total', align: 'right' },
    ]
    const rows: Cell[][] = [
      [{ text: 'A' }, { text: '10' }],
      [{ text: 'B' }, { text: '20' }],
    ]
    const footerRows: Cell[][] = [
      [{ text: 'Sum', bold: true }, { text: '30', bold: true }],
    ]
    const tui = renderTui(<Table columns={columns} rows={rows} footerRows={footerRows} />)
    await tui.flush()

    expect(tui.screen.contains('Sum')).toBe(true)
    expect(tui.screen.contains('30')).toBe(true)
    // Should have mid border before footer
    expect(tui.screen.contains('├')).toBe(true)
    tui.unmount()
  })

  test('handles empty data', async () => {
    const columns: Column[] = [
      { header: 'Symbol' },
      { header: 'Amount' },
    ]
    const tui = renderTui(<Table columns={columns} rows={[]} />)
    await tui.flush()

    expect(tui.screen.contains('Symbol')).toBe(true)
    expect(tui.screen.contains('Amount')).toBe(true)
    // Should still render borders
    expect(tui.screen.contains('╭')).toBe(true)
    expect(tui.screen.contains('╰')).toBe(true)
    tui.unmount()
  })

  test('selected columns subset', async () => {
    const data = [
      { name: 'VTI', shares: '100', price: '$250', secret: 'hidden' },
    ]
    const tui = renderTui(<Table data={data} columns={['name', 'shares']} />)
    await tui.flush()

    expect(tui.screen.contains('name')).toBe(true)
    expect(tui.screen.contains('shares')).toBe(true)
    expect(tui.screen.contains('secret')).toBe(false)
    expect(tui.screen.contains('hidden')).toBe(false)
    tui.unmount()
  })
})
