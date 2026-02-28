import { describe, expect, test } from 'bun:test'
import { formatTradesMarkdown, formatHoldingsMarkdown, formatTableMarkdown } from './format'
import type { Holding, Trade, TableData, TableCell } from './types'

describe('formatTradesMarkdown', () => {
  test('formats trades into markdown table', () => {
    const trades: Trade[] = [
      { account: 'roth', symbol: 'VTI', type: 'buy', shares: 50, amount: 5000 },
      { account: 'roth', symbol: 'VXUS', type: 'sell', shares: 30, amount: 3000 },
      { account: 'taxable', symbol: 'BND', type: 'buy', shares: 20, amount: 2000 },
    ]
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 100, price: 100, amount: 10000 },
      { account: 'roth', symbol: 'VXUS', shares: 80, price: 100, amount: 8000 },
      { account: 'taxable', symbol: 'BND', shares: 20, price: 100, amount: 2000 },
    ]

    const result = formatTradesMarkdown(trades, holdings, 'min_trades')

    expect(result).toContain('## Portfolio Rebalance')
    expect(result).toContain('$20,000.00')
    expect(result).toContain('Minimize Trades')
    expect(result).toContain('| Account | Symbol | Action | Shares | Amount |')
    expect(result).toContain('VTI')
    expect(result).toContain('BUY')
    expect(result).toContain('SELL')
    expect(result).toContain('**Sells:** 1 trade')
    expect(result).toContain('**Buys:** 2 trades')
  })

  test('handles no trades needed', () => {
    const trades: Trade[] = []
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 100, price: 100, amount: 10000 },
    ]

    const result = formatTradesMarkdown(trades, holdings, 'consolidate')

    expect(result).toContain('No trades needed')
    expect(result).toContain('Consolidate')
  })

  test('sorts sells before buys within same account', () => {
    const trades: Trade[] = [
      { account: 'roth', symbol: 'VTI', type: 'buy', shares: 10, amount: 1000 },
      { account: 'roth', symbol: 'VXUS', type: 'sell', shares: 10, amount: 1000 },
    ]
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 50, price: 100, amount: 5000 },
      { account: 'roth', symbol: 'VXUS', shares: 50, price: 100, amount: 5000 },
    ]

    const result = formatTradesMarkdown(trades, holdings, 'min_trades')
    const sellIndex = result.indexOf('SELL')
    const buyIndex = result.indexOf('BUY')

    expect(sellIndex).toBeLessThan(buyIndex)
  })
})

describe('formatHoldingsMarkdown', () => {
  test('formats holdings as markdown summary', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 100, price: 100, amount: 10000 },
      { account: 'roth', symbol: 'VXUS', shares: 50, price: 100, amount: 5000 },
      { account: 'taxable', symbol: 'BND', shares: 50, price: 100, amount: 5000 },
    ]

    const result = formatHoldingsMarkdown(holdings)

    expect(result).toContain('## Current Holdings')
    expect(result).toContain('$20,000.00')
    expect(result).toContain('VTI')
    expect(result).toContain('50.0%')
    expect(result).toContain('25.0%')
    expect(result).toContain('Shares')
  })
})

describe('formatTableMarkdown', () => {
  function makeTableData(): TableData {
    const cells = new Map<string, TableCell>()
    cells.set('VXUS:roth', { value: 15000 })
    cells.set('VXUS:taxable', { value: 5000 })
    cells.set('VTI:roth', { value: 10000 })

    return {
      rows: [
        { key: 'VXUS', label: 'VXUS', total: 20000 },
        { key: 'VTI', label: 'VTI', total: 10000 },
      ],
      cols: [
        { key: 'roth', label: 'roth', total: 25000 },
        { key: 'taxable', label: 'taxable', total: 5000 },
      ],
      cells,
    }
  }

  test('renders header with total and view label', () => {
    const result = formatTableMarkdown(makeTableData(), 'symbol', 'account')

    expect(result).toContain('## Current Portfolio')
    expect(result).toContain('$30,000.00')
    expect(result).toContain('**View:** Symbol × Account')
  })

  test('renders data rows with percentages and amounts', () => {
    const result = formatTableMarkdown(makeTableData(), 'symbol', 'account')

    // VXUS in roth: 15000/30000 = 50.0%
    expect(result).toContain('50.0% $15,000.00')
    // VTI total: 10000/30000 = 33.3%
    expect(result).toContain('33.3% $10,000.00')
  })

  test('renders empty cells for zero values', () => {
    const result = formatTableMarkdown(makeTableData(), 'symbol', 'account')

    // VTI:taxable has no cell, should be empty
    const vtiLine = result.split('\n').find(l => l.startsWith('| VTI'))!
    // The taxable column for VTI should be empty (just spaces between pipes)
    expect(vtiLine).toContain('|  |')
  })

  test('renders totals row', () => {
    const result = formatTableMarkdown(makeTableData(), 'symbol', 'account')

    expect(result).toContain('| **Total**')
    // Grand total: 100.0% $30,000.00
    expect(result).toContain('100.0% $30,000.00')
  })

  test('uses dimension labels', () => {
    const result = formatTableMarkdown(makeTableData(), 'countries', 'tax_status')
    expect(result).toContain('**View:** Country × Tax Status')
  })

  test('handles empty table data', () => {
    const emptyTable: TableData = {
      rows: [],
      cols: [],
      cells: new Map(),
    }

    const result = formatTableMarkdown(emptyTable, 'symbol', 'account')
    expect(result).toContain('No holdings data')
  })
})
