import { describe, expect, test } from 'bun:test'
import { generateTrades } from './trades'
import type { Holding } from './types'

describe('generateTrades', () => {
  test('generates buy trade when targetShares > current shares', () => {
    const holdings: Holding[] = [
      { account: 'Roth IRA', symbol: 'VTI', shares: 10, price: 100, amount: 1000, targetShares: 15, targetAmount: 1500 },
    ]
    const trades = generateTrades(holdings)
    expect(trades).toEqual([
      { account: 'Roth IRA', symbol: 'VTI', type: 'buy', shares: 5, amount: 500 },
    ])
  })

  test('generates sell trade when targetShares < current shares', () => {
    const holdings: Holding[] = [
      { account: 'Taxable', symbol: 'VXUS', shares: 20, price: 100, amount: 2000, targetShares: 12, targetAmount: 1200 },
    ]
    const trades = generateTrades(holdings)
    expect(trades).toEqual([
      { account: 'Taxable', symbol: 'VXUS', type: 'sell', shares: 8, amount: 800 },
    ])
  })

  test('skips holdings without targetShares', () => {
    const holdings: Holding[] = [
      { account: 'Roth IRA', symbol: 'VTI', shares: 10, price: 100, amount: 1000 },
    ]
    const trades = generateTrades(holdings)
    expect(trades).toEqual([])
  })

  test('skips holdings with no share delta', () => {
    const holdings: Holding[] = [
      { account: 'Roth IRA', symbol: 'VTI', shares: 10, price: 100, amount: 1000, targetShares: 10, targetAmount: 1000 },
    ]
    const trades = generateTrades(holdings)
    expect(trades).toEqual([])
  })

  test('generates multiple trades', () => {
    const holdings: Holding[] = [
      { account: 'Roth IRA', symbol: 'VTI', shares: 10, price: 100, amount: 1000, targetShares: 15, targetAmount: 1500 },
      { account: 'Roth IRA', symbol: 'VXUS', shares: 20, price: 100, amount: 2000, targetShares: 15, targetAmount: 1500 },
      { account: 'Taxable', symbol: 'VTI', shares: 5, price: 100, amount: 500, targetShares: 8, targetAmount: 800 },
    ]
    const trades = generateTrades(holdings)
    expect(trades).toHaveLength(3)
    expect(trades).toContainEqual({ account: 'Roth IRA', symbol: 'VTI', type: 'buy', shares: 5, amount: 500 })
    expect(trades).toContainEqual({ account: 'Roth IRA', symbol: 'VXUS', type: 'sell', shares: 5, amount: 500 })
    expect(trades).toContainEqual({ account: 'Taxable', symbol: 'VTI', type: 'buy', shares: 3, amount: 300 })
  })
})
