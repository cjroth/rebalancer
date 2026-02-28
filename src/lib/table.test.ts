import { describe, expect, test } from 'bun:test'
import { computeTableData } from './table'
import type { Symbol, Account, Holding } from './types'

const testSymbols: Symbol[] = [
  {
    name: 'SPY',
    price: 500,
    countries: { us: 1 },
    assets: { equity: 1 },
    beta: 1.0,
  },
  {
    name: 'VXUS',
    price: 50,
    countries: { cn: 0.1, other: 0.9 },
    assets: { equity: 1 },
    beta: 0.85,
  },
]

const testAccounts: Account[] = [
  { name: 'account1', tax_status: 'roth', provider: 'schwab', owner: 'alex' },
  { name: 'account2', tax_status: 'taxable', provider: 'vanguard', owner: 'sam' },
]

const testHoldings: Holding[] = [
  { account: 'account1', symbol: 'SPY', shares: 20, price: 500, amount: 10000 },
  { account: 'account2', symbol: 'VXUS', shares: 400, price: 50, amount: 20000 },
]

describe('computeTableData', () => {
  test('ungrouped view shows individual symbols and accounts', () => {
    const result = computeTableData(testSymbols, testAccounts, testHoldings, 'symbol', 'account')

    expect(result.rows).toHaveLength(2)
    expect(result.cols).toHaveLength(2)

    const spyRow = result.rows.find(r => r.key === 'SPY')
    const vxusRow = result.rows.find(r => r.key === 'VXUS')

    expect(spyRow?.total).toBe(10000)
    expect(vxusRow?.total).toBe(20000)
  })

  test('grouping by country calculates weighted exposure', () => {
    const result = computeTableData(testSymbols, testAccounts, testHoldings, 'countries', 'account')

    const usRow = result.rows.find(r => r.key === 'us')
    const cnRow = result.rows.find(r => r.key === 'cn')
    const otherRow = result.rows.find(r => r.key === 'other')

    expect(usRow?.total).toBe(10000) // SPY 100% US
    expect(cnRow?.total).toBe(2000) // VXUS 10% of 20000
    expect(otherRow?.total).toBe(18000) // VXUS 90% of 20000
  })

  test('grouping by tax status aggregates accounts', () => {
    const result = computeTableData(testSymbols, testAccounts, testHoldings, 'symbol', 'tax_status')

    expect(result.cols).toHaveLength(2)

    const rothCol = result.cols.find(c => c.key === 'roth')
    const taxableCol = result.cols.find(c => c.key === 'taxable')

    expect(rothCol?.total).toBe(10000)
    expect(taxableCol?.total).toBe(20000)
  })

  test('grouping both dimensions aggregates correctly', () => {
    const result = computeTableData(testSymbols, testAccounts, testHoldings, 'countries', 'tax_status')

    const usRothCell = result.cells.get('us:roth')
    expect(usRothCell?.value).toBe(10000)

    const cnTaxableCell = result.cells.get('cn:taxable')
    expect(cnTaxableCell?.value).toBe(2000)
  })

  test('beta grouping categorizes by ranges', () => {
    const result = computeTableData(testSymbols, testAccounts, testHoldings, 'beta', 'account')

    const highBeta = result.rows.find(r => r.key === 'high') // SPY beta = 1.0
    const mediumBeta = result.rows.find(r => r.key === 'medium') // VXUS beta = 0.85

    expect(highBeta).toBeDefined()
    expect(mediumBeta).toBeDefined()
    expect(highBeta?.symbols).toContain('SPY')
    expect(mediumBeta?.symbols).toContain('VXUS')
    expect(highBeta?.label).toBe('Beta: High')
    expect(mediumBeta?.label).toBe('Beta: Medium')
  })

  test('rows and columns are sorted by total descending', () => {
    const result = computeTableData(testSymbols, testAccounts, testHoldings, 'symbol', 'account')

    // VXUS (20000) should come before SPY (10000)
    expect(result.rows[0].key).toBe('VXUS')
    expect(result.rows[1].key).toBe('SPY')
    expect(result.rows[0].total).toBeGreaterThanOrEqual(result.rows[1].total)
    expect(result.cols[0].total).toBeGreaterThanOrEqual(result.cols[1].total)
  })

  test('child cells preserve original holding amounts', () => {
    const result = computeTableData(testSymbols, testAccounts, testHoldings, 'countries', 'account')

    expect(result.childCells?.get('SPY:account1')?.value).toBe(10000)
    expect(result.childCells?.get('VXUS:account2')?.value).toBe(20000)
  })

  test('handles missing dimension data gracefully', () => {
    const symbolsNoMeta: Symbol[] = [
      { name: 'SPY', price: 500 },
      { name: 'VXUS', price: 50 },
    ]

    // countries dimension with no countries data - should produce no rows
    const result = computeTableData(symbolsNoMeta, testAccounts, testHoldings, 'countries', 'account')
    expect(result.rows).toHaveLength(0)

    // symbol dimension still works
    const result2 = computeTableData(symbolsNoMeta, testAccounts, testHoldings, 'symbol', 'account')
    expect(result2.rows).toHaveLength(2)
  })

  test('handles missing account dimension data gracefully', () => {
    const accountsNoMeta: Account[] = [
      { name: 'account1' },
      { name: 'account2' },
    ]

    // tax_status dimension with no tax_status data - should produce no cols
    const result = computeTableData(testSymbols, accountsNoMeta, testHoldings, 'symbol', 'tax_status')
    expect(result.cols).toHaveLength(0)

    // account dimension still works
    const result2 = computeTableData(testSymbols, accountsNoMeta, testHoldings, 'symbol', 'account')
    expect(result2.cols).toHaveLength(2)
  })
})
