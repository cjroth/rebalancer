import { describe, expect, test } from 'bun:test'
import type { Account, Holding, Symbol } from './types'
import { calculateRebalance, calculateRebalanceMinTrades, calculateTargetPercentSum, isTargetPercentValid, convertToWholeShares } from './rebalance'
import { generateTrades } from './trades'

describe('calculateTargetPercentSum', () => {
  test('returns 0 for symbols with no targets', () => {
    const symbols: Symbol[] = [
      { name: 'AAPL', price: 150, countries: { us: 1 }, assets: { equity: 1 }, beta: 1.0 },
      { name: 'GOOGL', price: 100, countries: { us: 1 }, assets: { equity: 1 }, beta: 1.1 },
    ]
    expect(calculateTargetPercentSum(symbols)).toBe(0)
  })

  test('sums target percentages correctly', () => {
    const symbols: Symbol[] = [
      { name: 'AAPL', price: 150, countries: { us: 1 }, assets: { equity: 1 }, beta: 1.0, targetPercent: 60 },
      { name: 'GOOGL', price: 100, countries: { us: 1 }, assets: { equity: 1 }, beta: 1.1, targetPercent: 40 },
    ]
    expect(calculateTargetPercentSum(symbols)).toBe(100)
  })

  test('handles partial targets', () => {
    const symbols: Symbol[] = [
      { name: 'AAPL', price: 150, countries: { us: 1 }, assets: { equity: 1 }, beta: 1.0, targetPercent: 50 },
      { name: 'GOOGL', price: 100, countries: { us: 1 }, assets: { equity: 1 }, beta: 1.1 },
    ]
    expect(calculateTargetPercentSum(symbols)).toBe(50)
  })
})

describe('isTargetPercentValid', () => {
  test('returns true when sum equals 100', () => {
    const symbols: Symbol[] = [
      { name: 'AAPL', price: 150, countries: { us: 1 }, assets: { equity: 1 }, beta: 1.0, targetPercent: 60 },
      { name: 'GOOGL', price: 100, countries: { us: 1 }, assets: { equity: 1 }, beta: 1.1, targetPercent: 40 },
    ]
    expect(isTargetPercentValid(symbols)).toBe(true)
  })

  test('returns false when sum does not equal 100', () => {
    const symbols: Symbol[] = [
      { name: 'AAPL', price: 150, countries: { us: 1 }, assets: { equity: 1 }, beta: 1.0, targetPercent: 50 },
      { name: 'GOOGL', price: 100, countries: { us: 1 }, assets: { equity: 1 }, beta: 1.1, targetPercent: 30 },
    ]
    expect(isTargetPercentValid(symbols)).toBe(false)
  })
})

// Helper to make holdings with shares/price/amount
function h(account: string, symbol: string, shares: number, price: number): Holding {
  return { account, symbol, shares, price, amount: shares * price }
}

describe('calculateRebalance (consolidate strategy)', () => {
  const accounts: Account[] = [
    { name: 'roth' },
    { name: 'taxable' },
  ]

  test('allocates to as few accounts as possible', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 60 },
      { name: 'VXUS', price: 100, targetPercent: 40 },
    ]
    const holdings: Holding[] = [
      h('roth', 'VTI', 60, 100),
      h('taxable', 'VXUS', 40, 100),
    ]

    const result = calculateRebalance(symbols, accounts, holdings)

    const rothVTI = result.find(r => r.account === 'roth' && r.symbol === 'VTI')
    const taxableVXUS = result.find(r => r.account === 'taxable' && r.symbol === 'VXUS')

    expect(rothVTI?.targetAmount).toBe(6000)
    expect(taxableVXUS?.targetAmount).toBe(4000)
  })

  test('preserves account totals', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 50 },
      { name: 'VXUS', price: 100, targetPercent: 50 },
    ]
    const holdings: Holding[] = [
      h('roth', 'VTI', 70, 100),
      h('taxable', 'VXUS', 30, 100),
    ]

    const result = calculateRebalance(symbols, accounts, holdings)

    const rothTotal = result
      .filter(r => r.account === 'roth')
      .reduce((sum, r) => sum + (r.targetAmount || 0), 0)
    const taxableTotal = result
      .filter(r => r.account === 'taxable')
      .reduce((sum, r) => sum + (r.targetAmount || 0), 0)

    expect(rothTotal).toBeCloseTo(7000, 0)
    expect(taxableTotal).toBeCloseTo(3000, 0)
  })
})

describe('calculateRebalanceMinTrades', () => {
  const accounts: Account[] = [
    { name: 'roth' },
    { name: 'taxable' },
  ]

  test('generates fewer trades than consolidate strategy', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 50 },
      { name: 'VXUS', price: 100, targetPercent: 30 },
      { name: 'BND', price: 100, targetPercent: 20 },
    ]
    const holdings: Holding[] = [
      h('roth', 'VTI', 40, 100),
      h('roth', 'VXUS', 30, 100),
      h('taxable', 'VTI', 20, 100),
      h('taxable', 'BND', 10, 100),
    ]

    const consolidateResult = convertToWholeShares(calculateRebalance(symbols, accounts, holdings))
    const minTradesResult = convertToWholeShares(calculateRebalanceMinTrades(symbols, accounts, holdings))

    const consolidateTrades = generateTrades(consolidateResult)
    const minTradesTrades = generateTrades(minTradesResult)

    expect(minTradesTrades.length).toBeLessThanOrEqual(consolidateTrades.length)
  })

  test('preserves account totals', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 60 },
      { name: 'VXUS', price: 100, targetPercent: 40 },
    ]
    const holdings: Holding[] = [
      h('roth', 'VTI', 50, 100),
      h('roth', 'VXUS', 20, 100),
      h('taxable', 'VTI', 10, 100),
      h('taxable', 'VXUS', 20, 100),
    ]

    const result = calculateRebalanceMinTrades(symbols, accounts, holdings)

    const rothTotal = result
      .filter(r => r.account === 'roth')
      .reduce((sum, r) => sum + (r.targetAmount || 0), 0)
    const taxableTotal = result
      .filter(r => r.account === 'taxable')
      .reduce((sum, r) => sum + (r.targetAmount || 0), 0)

    expect(rothTotal).toBeCloseTo(7000, 0)
    expect(taxableTotal).toBeCloseTo(3000, 0)
  })
})

describe('convertToWholeShares', () => {
  test('converts fractional target amounts to whole shares', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 10, price: 100, amount: 1000, targetAmount: 1550 },
    ]
    const result = convertToWholeShares(holdings)
    expect(result[0]!.targetShares).toBe(16) // round(15.5) = 16
    expect(result[0]!.targetAmount).toBe(1600)
  })

  test('distributes remainder shares by largest remainder method', () => {
    // Two holdings of same symbol, total ideal = 10.7 shares
    // h1: ideal 7.4, floor 7, remainder 0.4
    // h2: ideal 3.3, floor 3, remainder 0.3
    // total floored = 10, round(10.7) = 11, extra = 1
    // h1 gets the extra (largest remainder)
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 8, price: 100, amount: 800, targetAmount: 740 },
      { account: 'taxable', symbol: 'VTI', shares: 2, price: 100, amount: 200, targetAmount: 330 },
    ]
    const result = convertToWholeShares(holdings)
    const roth = result.find(h => h.account === 'roth')
    const taxable = result.find(h => h.account === 'taxable')
    expect(roth!.targetShares! + taxable!.targetShares!).toBe(11)
    expect(roth!.targetShares).toBe(8) // 7 + 1 extra
    expect(taxable!.targetShares).toBe(3)
  })

  test('handles holdings with no targetAmount', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 10, price: 100, amount: 1000 },
    ]
    const result = convertToWholeShares(holdings)
    expect(result[0]!.targetShares).toBe(10) // keeps current shares
  })

  test('handles cash (price = 1)', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'CASH', shares: 500, price: 1, amount: 500, targetAmount: 750.60 },
    ]
    const result = convertToWholeShares(holdings)
    expect(result[0]!.targetShares).toBe(751)
    expect(result[0]!.targetAmount).toBe(751)
  })

  test('no account target total exceeds its original total', () => {
    // Account "small" has $500 (5 shares * $100). Two symbols both round up in this
    // account, pushing it to $600 without the budget fix.
    // VTI: small gets targetAmount $250 → ideal 2.5 → rounds to 3 ($300)
    // VXUS: small gets targetAmount $250 → ideal 2.5 → rounds to 3 ($300)
    // Total would be $600, exceeding $500. The fix should reduce one to 2 shares.
    const holdings: Holding[] = [
      { account: 'small', symbol: 'VTI', shares: 3, price: 100, amount: 300, targetAmount: 250 },
      { account: 'small', symbol: 'VXUS', shares: 2, price: 100, amount: 200, targetAmount: 250 },
      { account: 'big', symbol: 'VTI', shares: 50, price: 100, amount: 5000, targetAmount: 4750 },
      { account: 'big', symbol: 'VXUS', shares: 50, price: 100, amount: 5000, targetAmount: 4750 },
    ]

    const result = convertToWholeShares(holdings)

    // Check per-account budget constraint
    const accounts = new Set(result.map(h => h.account))
    for (const account of accounts) {
      const accountHoldings = result.filter(h => h.account === account)
      const originalTotal = accountHoldings.reduce((sum, h) => sum + h.shares * h.price, 0)
      const targetTotal = accountHoldings.reduce((sum, h) => sum + (h.targetShares ?? h.shares) * h.price, 0)
      expect(targetTotal).toBeLessThanOrEqual(originalTotal + 0.01)
    }
  })

  test('empty input returns empty', () => {
    expect(convertToWholeShares([])).toEqual([])
  })

  test('exact whole share targets need no rounding', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 10, price: 100, amount: 1000, targetAmount: 1500 },
    ]
    const result = convertToWholeShares(holdings)
    expect(result[0]!.targetShares).toBe(15)
    expect(result[0]!.targetAmount).toBe(1500)
  })

  test('targetAmount: 0 results in 0 targetShares', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 10, price: 100, amount: 1000, targetAmount: 0 },
    ]
    const result = convertToWholeShares(holdings)
    expect(result[0]!.targetShares).toBe(0)
    expect(result[0]!.targetAmount).toBe(0)
  })

  test('budget fix requires multiple iterations when 3+ symbols round up in one account', () => {
    // Account has $700 total. Three symbols each get targetAmount ~$233.33.
    // Ideal shares: 2.33 each → floor=2, remainder=0.33. Total ideal=7.0, floored=6, extra=1.
    // One gets rounded to 3 ($300), two stay at 2 ($200 each). Total = $700. OK.
    // But let's make it so all three round up:
    // targetAmounts: $250, $250, $250 = $750 pre-rounding (over budget, skip).
    // Instead: use amounts that are within budget but all have remainder > 0.5:
    // Account has $1000. Three symbols: targetAmount $350, $350, $300 = $1000.
    // Ideals: 3.5, 3.5, 3.0. Floors: 3, 3, 3. Total ideal=10. Floored=9. Extra=1.
    // Only one gets rounded up (3→4). Total = 4+3+3 = 10 shares = $1000. Within budget.
    //
    // Better scenario: 4 symbols, small account.
    // Account has $500. 4 symbols at $100 each, all get targetAmount $125.
    // Pre-rounding sum = $500. Ideal shares: 1.25 each. Floor: 1 each (total 4).
    // Total ideal = 5.0, round(5.0) = 5, extra = 1. One rounds up to 2.
    // Post-rounding: 2+1+1+1 = 5 shares = $500. Within budget.
    //
    // We need a scenario where the SYMBOL-level rounding gives multiple extras
    // to the same account. Since rounding is per-symbol, extras go to the
    // holding with the largest remainder within each symbol group.
    //
    // Real scenario: 3 symbols each spanning 2 accounts.
    // "small" account has $300. Each of 3 symbols has a holding in "small" with
    // targetAmount = $110 (total $330 > $300, but that's pre-rounding over budget).
    //
    // We need sum(targetAmount) = sum(amount) for the account.
    // small: SYM_A $100, SYM_B $100, SYM_C $100 = $300 total.
    // targetAmounts: SYM_A $150, SYM_B $150, SYM_C $0 = $300.
    // But these are different symbols so rounding is independent.
    // SYM_A: small gets $150 → 1.5 shares. big gets $850 → 8.5. Total=10. floor=9, extra=1.
    //   Both have remainder 0.5. Tie: sort is stable, first one gets it.
    // SYM_B: same pattern.
    // If small wins the extra share for both SYM_A and SYM_B:
    //   small: 2*100 + 2*100 + 0 = $400 > $300 budget!
    // This would need the budget fix to iterate twice.

    const holdings: Holding[] = [
      // small account: $300 total
      { account: 'small', symbol: 'SYM_A', shares: 1, price: 100, amount: 100, targetAmount: 150 },
      { account: 'small', symbol: 'SYM_B', shares: 1, price: 100, amount: 100, targetAmount: 150 },
      { account: 'small', symbol: 'SYM_C', shares: 1, price: 100, amount: 100, targetAmount: 0 },
      // big account: $1700 total
      { account: 'big', symbol: 'SYM_A', shares: 8, price: 100, amount: 800, targetAmount: 850 },
      { account: 'big', symbol: 'SYM_B', shares: 8, price: 100, amount: 800, targetAmount: 850 },
      { account: 'big', symbol: 'SYM_C', shares: 1, price: 100, amount: 100, targetAmount: 0 },
    ]

    const result = convertToWholeShares(holdings)

    const smallHoldings = result.filter(r => r.account === 'small')
    const smallOriginal = smallHoldings.reduce((sum, r) => sum + r.shares * r.price, 0)
    const smallTarget = smallHoldings.reduce((sum, r) => sum + (r.targetShares ?? r.shares) * r.price, 0)
    expect(smallTarget).toBeLessThanOrEqual(smallOriginal + 0.01)
  })

  test('prefers reducing rounded-up holdings over non-rounded-up ones', () => {
    // small account: SYM_A (1 share * $200 = $200) + SYM_B (6 shares * $50 = $300). Budget = $500.
    // SYM_A target: $350 → 1.75 ideal shares. Floor=1, remainder=0.75.
    // SYM_B target: $150 → 3.0 ideal shares. Floor=3, remainder=0. Exact.
    // Pre-rounding: 350 + 150 = $500 ≤ $500. ✓
    //
    // SYM_A group: small r=0.75, big r=0.25. Small wins extra → 2 shares = $400.
    // SYM_B group: small r=0.0, big r=0.0. No extras. small stays at 3 = $150.
    // Post-rounding: 400 + 150 = $550 > $500. Budget fix kicks in.
    //
    // SYM_A was rounded up (targetShares=2 > floor=1). SYM_B was NOT (3 == 3).
    // Fix should reduce SYM_A (the rounded-up one) → 1 share = $200.
    // Result: $200 + $150 = $350 ≤ $500. ✓
    const holdings: Holding[] = [
      { account: 'small', symbol: 'SYM_A', shares: 1, price: 200, amount: 200, targetAmount: 350 },
      { account: 'small', symbol: 'SYM_B', shares: 6, price: 50, amount: 300, targetAmount: 150 },
      { account: 'big', symbol: 'SYM_A', shares: 25, price: 200, amount: 5000, targetAmount: 4650 },
      { account: 'big', symbol: 'SYM_B', shares: 100, price: 50, amount: 5000, targetAmount: 5350 },
    ]

    const result = convertToWholeShares(holdings)
    const smallA = result.find(r => r.account === 'small' && r.symbol === 'SYM_A')
    const smallB = result.find(r => r.account === 'small' && r.symbol === 'SYM_B')

    // SYM_A was rounded up → should be reduced. SYM_B was exact → untouched.
    expect(smallA!.targetShares).toBe(1)
    expect(smallB!.targetShares).toBe(3)
  })
})

// =======================================================================
// Shared helpers for strategy tests
// =======================================================================

/** Sum of targetAmount for one account */
function accountTargetTotal(result: Holding[], account: string): number {
  return result.filter(r => r.account === account).reduce((sum, r) => sum + (r.targetAmount ?? 0), 0)
}

/** Sum of targetAmount for one symbol across all accounts */
function symbolTargetTotal(result: Holding[], symbol: string): number {
  return result.filter(r => r.symbol === symbol).reduce((sum, r) => sum + (r.targetAmount ?? 0), 0)
}

// =======================================================================
// calculateRebalance — additional tests
// =======================================================================

describe('calculateRebalance (consolidate) — extended', () => {
  test('targetPercent: 0 means sell everything (target $0)', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 100 },
      { name: 'VXUS', price: 100, targetPercent: 0 },
    ]
    const accounts: Account[] = [{ name: 'roth' }]
    const holdings: Holding[] = [
      h('roth', 'VTI', 50, 100),
      h('roth', 'VXUS', 50, 100),
    ]

    const result = calculateRebalance(symbols, accounts, holdings)
    const vxus = result.find(r => r.symbol === 'VXUS')
    expect(vxus?.targetAmount).toBe(0)

    const vti = result.find(r => r.symbol === 'VTI')
    expect(vti?.targetAmount).toBe(10000)
  })

  test('holding not in symbol list is marked for selling', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 100 },
    ]
    const accounts: Account[] = [{ name: 'roth' }]
    const holdings: Holding[] = [
      h('roth', 'VTI', 50, 100),
      h('roth', 'OLD_FUND', 50, 100),
    ]

    const result = calculateRebalance(symbols, accounts, holdings)
    const oldFund = result.find(r => r.symbol === 'OLD_FUND')
    expect(oldFund).toBeDefined()
    expect(oldFund!.targetAmount).toBe(0)
  })

  test('three accounts — consolidates into fewest', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 60 },
      { name: 'VXUS', price: 100, targetPercent: 40 },
    ]
    const accounts: Account[] = [{ name: 'a1' }, { name: 'a2' }, { name: 'a3' }]
    const holdings: Holding[] = [
      h('a1', 'VTI', 50, 100),  // $5000
      h('a2', 'VTI', 30, 100),  // $3000
      h('a3', 'VTI', 20, 100),  // $2000
    ]
    // Total $10000. VTI target $6000, VXUS target $4000.
    // Largest account first: a1 ($5000) → VTI gets $5000, a2 ($3000) → VTI gets $1000
    // Remaining VXUS $4000: a2 has $2000 left, a3 has $2000 → fills both.

    const result = calculateRebalance(symbols, accounts, holdings)

    // Account totals must be preserved
    expect(accountTargetTotal(result, 'a1')).toBeCloseTo(5000, 0)
    expect(accountTargetTotal(result, 'a2')).toBeCloseTo(3000, 0)
    expect(accountTargetTotal(result, 'a3')).toBeCloseTo(2000, 0)

    // Symbol totals must match targets
    expect(symbolTargetTotal(result, 'VTI')).toBeCloseTo(6000, 0)
    expect(symbolTargetTotal(result, 'VXUS')).toBeCloseTo(4000, 0)
  })

  test('unequal account sizes — still preserves totals', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 200, targetPercent: 50 },
      { name: 'BND', price: 50, targetPercent: 50 },
    ]
    const accounts: Account[] = [{ name: 'big' }, { name: 'small' }]
    const holdings: Holding[] = [
      h('big', 'VTI', 40, 200),    // $8000
      h('small', 'BND', 40, 50),   // $2000
    ]
    // Total $10000. VTI target $5000, BND target $5000.

    const result = calculateRebalance(symbols, accounts, holdings)

    expect(accountTargetTotal(result, 'big')).toBeCloseTo(8000, 0)
    expect(accountTargetTotal(result, 'small')).toBeCloseTo(2000, 0)
    expect(symbolTargetTotal(result, 'VTI')).toBeCloseTo(5000, 0)
    expect(symbolTargetTotal(result, 'BND')).toBeCloseTo(5000, 0)
  })

  test('single account single symbol — no-op', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 100 },
    ]
    const accounts: Account[] = [{ name: 'roth' }]
    const holdings: Holding[] = [h('roth', 'VTI', 50, 100)]

    const result = calculateRebalance(symbols, accounts, holdings)
    expect(result).toHaveLength(1)
    expect(result[0]!.targetAmount).toBe(5000)
    expect(result[0]!.shares).toBe(50)
  })
})

// =======================================================================
// calculateRebalanceMinTrades — extended tests
// =======================================================================

describe('calculateRebalanceMinTrades — extended', () => {
  test('already at target — no trades needed', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 60 },
      { name: 'VXUS', price: 100, targetPercent: 40 },
    ]
    const accounts: Account[] = [{ name: 'roth' }]
    const holdings: Holding[] = [
      h('roth', 'VTI', 60, 100),
      h('roth', 'VXUS', 40, 100),
    ]
    // Already at 60/40. No trades needed.
    const result = convertToWholeShares(calculateRebalanceMinTrades(symbols, accounts, holdings))
    const trades = generateTrades(result)
    expect(trades).toHaveLength(0)
  })

  test('preserves account totals with 3 accounts and 3 symbols', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 50 },
      { name: 'VXUS', price: 100, targetPercent: 30 },
      { name: 'BND', price: 100, targetPercent: 20 },
    ]
    const accounts: Account[] = [{ name: 'roth' }, { name: 'trad' }, { name: 'taxable' }]
    const holdings: Holding[] = [
      h('roth', 'VTI', 20, 100),
      h('roth', 'VXUS', 30, 100),
      h('trad', 'VTI', 10, 100),
      h('trad', 'BND', 20, 100),
      h('taxable', 'VXUS', 10, 100),
      h('taxable', 'BND', 10, 100),
    ]
    // Total: $10000. roth=$5000, trad=$3000, taxable=$2000.

    const result = calculateRebalanceMinTrades(symbols, accounts, holdings)

    expect(accountTargetTotal(result, 'roth')).toBeCloseTo(5000, 0)
    expect(accountTargetTotal(result, 'trad')).toBeCloseTo(3000, 0)
    expect(accountTargetTotal(result, 'taxable')).toBeCloseTo(2000, 0)
  })

  test('sell-heavy rebalance — reduces overweight symbol', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 30 },
      { name: 'VXUS', price: 100, targetPercent: 70 },
    ]
    const accounts: Account[] = [{ name: 'roth' }]
    const holdings: Holding[] = [
      h('roth', 'VTI', 70, 100),  // 70% but target 30%
      h('roth', 'VXUS', 30, 100), // 30% but target 70%
    ]

    const result = calculateRebalanceMinTrades(symbols, accounts, holdings)

    // VTI should decrease, VXUS should increase
    const vti = result.find(r => r.symbol === 'VTI')!
    const vxus = result.find(r => r.symbol === 'VXUS')!

    expect(vti.targetAmount!).toBeCloseTo(3000, 0)
    expect(vxus.targetAmount!).toBeCloseTo(7000, 0)
    expect(accountTargetTotal(result, 'roth')).toBeCloseTo(10000, 0)
  })

  test('symbol with targetPercent: 0 gets sold entirely', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 100 },
      { name: 'OLD', price: 100, targetPercent: 0 },
    ]
    const accounts: Account[] = [{ name: 'roth' }]
    const holdings: Holding[] = [
      h('roth', 'VTI', 50, 100),
      h('roth', 'OLD', 50, 100),
    ]

    const result = calculateRebalanceMinTrades(symbols, accounts, holdings)

    const old = result.find(r => r.symbol === 'OLD')!
    const vti = result.find(r => r.symbol === 'VTI')!

    expect(old.targetAmount!).toBeCloseTo(0, 0)
    expect(vti.targetAmount!).toBeCloseTo(10000, 0)
  })

  test('noise threshold skips tiny deltas — no unnecessary trades', () => {
    // Portfolio total $100,000. Noise threshold = $100,000 * 0.0002 = $20.
    // VTI price = $100, so threshold = max($100, $20) = $100.
    // If VTI delta is $50 (less than 1 share), it should be skipped.
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 50.05 },  // target = $50,050
      { name: 'VXUS', price: 100, targetPercent: 49.95 },  // target = $49,950
    ]
    const accounts: Account[] = [{ name: 'roth' }]
    const holdings: Holding[] = [
      h('roth', 'VTI', 500, 100),   // $50,000 (target $50,050 — delta $50)
      h('roth', 'VXUS', 500, 100),  // $50,000 (target $49,950 — delta -$50)
    ]

    const result = convertToWholeShares(calculateRebalanceMinTrades(symbols, accounts, holdings))
    const trades = generateTrades(result)
    // Delta of $50 is below 1-share threshold ($100), should produce no trades
    expect(trades).toHaveLength(0)
  })

  test('new symbol not currently held gets allocated', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 60 },
      { name: 'VXUS', price: 100, targetPercent: 20 },
      { name: 'BND', price: 100, targetPercent: 20 },
    ]
    const accounts: Account[] = [{ name: 'roth' }]
    const holdings: Holding[] = [
      h('roth', 'VTI', 80, 100),   // $8000
      h('roth', 'VXUS', 20, 100),  // $2000
      // BND not held at all
    ]

    const result = calculateRebalanceMinTrades(symbols, accounts, holdings)

    const bnd = result.find(r => r.symbol === 'BND')
    expect(bnd).toBeDefined()
    // BND target is 20% of $10000 = $2000
    expect(bnd!.targetAmount!).toBeCloseTo(2000, 0)
    expect(accountTargetTotal(result, 'roth')).toBeCloseTo(10000, 0)
  })

  test('capacity spills into accounts that dont currently hold the symbol', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 100, targetPercent: 80 },
      { name: 'VXUS', price: 100, targetPercent: 20 },
    ]
    const accounts: Account[] = [{ name: 'roth' }, { name: 'taxable' }]
    const holdings: Holding[] = [
      h('roth', 'VTI', 10, 100),    // $1000
      h('taxable', 'VXUS', 90, 100), // $9000
    ]
    // Total $10000. VTI target $8000, VXUS target $2000.
    // VTI delta: +$7000. VXUS delta: -$7000.
    // roth has $1000 total, taxable has $9000 total.
    // VTI needs to expand: roth can't provide much capacity (only $1000 total).
    // Most of VTI must end up in taxable.

    const result = calculateRebalanceMinTrades(symbols, accounts, holdings)

    expect(accountTargetTotal(result, 'roth')).toBeCloseTo(1000, 0)
    expect(accountTargetTotal(result, 'taxable')).toBeCloseTo(9000, 0)
    expect(symbolTargetTotal(result, 'VTI')).toBeCloseTo(8000, 0)
    expect(symbolTargetTotal(result, 'VXUS')).toBeCloseTo(2000, 0)
  })
})

// =======================================================================
// Both strategies — property-based invariant tests
// =======================================================================

describe('both strategies preserve invariants', () => {
  const strategies = [
    { name: 'consolidate', fn: calculateRebalance },
    { name: 'min_trades', fn: calculateRebalanceMinTrades },
  ] as const

  // Complex multi-account, multi-symbol scenario
  const symbols: Symbol[] = [
    { name: 'VTI', price: 250, targetPercent: 40 },
    { name: 'VXUS', price: 60, targetPercent: 25 },
    { name: 'BND', price: 80, targetPercent: 20 },
    { name: 'BNDX', price: 55, targetPercent: 15 },
  ]
  const accounts: Account[] = [
    { name: 'roth' },
    { name: 'trad_ira' },
    { name: 'taxable' },
  ]
  const holdings: Holding[] = [
    h('roth', 'VTI', 20, 250),     // $5000
    h('roth', 'VXUS', 50, 60),     // $3000
    h('trad_ira', 'BND', 100, 80), // $8000
    h('trad_ira', 'VTI', 8, 250),  // $2000
    h('taxable', 'VTI', 40, 250),  // $10000
    h('taxable', 'VXUS', 50, 60),  // $3000
    h('taxable', 'BNDX', 20, 55),  // $1100
  ]
  // Total: $32100

  for (const { name, fn } of strategies) {
    test(`${name}: every account's target total equals its original total`, () => {
      const result = fn(symbols, accounts, holdings)

      const accountOriginals = new Map<string, number>()
      holdings.forEach(hold => {
        accountOriginals.set(hold.account, (accountOriginals.get(hold.account) || 0) + hold.amount)
      })

      for (const [account, original] of accountOriginals) {
        expect(accountTargetTotal(result, account)).toBeCloseTo(original, 0)
      }
    })

    test(`${name}: symbol totals match target percentages`, () => {
      const result = fn(symbols, accounts, holdings)
      const totalValue = holdings.reduce((sum, hold) => sum + hold.amount, 0)

      for (const sym of symbols) {
        if (sym.targetPercent !== undefined && sym.targetPercent > 0) {
          const expected = totalValue * (sym.targetPercent / 100)
          expect(symbolTargetTotal(result, sym.name)).toBeCloseTo(expected, 0)
        }
      }
    })

    test(`${name}: no negative targetAmounts`, () => {
      const result = fn(symbols, accounts, holdings)
      for (const r of result) {
        expect(r.targetAmount).toBeGreaterThanOrEqual(0)
      }
    })

    test(`${name}: after convertToWholeShares, no account exceeds budget`, () => {
      const result = convertToWholeShares(fn(symbols, accounts, holdings))

      const accountOriginals = new Map<string, number>()
      holdings.forEach(hold => {
        accountOriginals.set(hold.account, (accountOriginals.get(hold.account) || 0) + hold.amount)
      })

      for (const [account, original] of accountOriginals) {
        const target = result
          .filter(r => r.account === account)
          .reduce((sum, r) => sum + (r.targetShares ?? r.shares) * r.price, 0)
        expect(target).toBeLessThanOrEqual(original + 0.01)
      }
    })
  }
})

// =======================================================================
// generateTrades — extended tests
// =======================================================================

describe('generateTrades — extended', () => {
  test('empty input returns empty', () => {
    expect(generateTrades([])).toEqual([])
  })

  test('sell trade has correct shares and amount', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 10, price: 250, amount: 2500, targetShares: 6 },
    ]
    const trades = generateTrades(holdings)
    expect(trades).toHaveLength(1)
    expect(trades[0]!.type).toBe('sell')
    expect(trades[0]!.shares).toBe(4)
    expect(trades[0]!.amount).toBe(1000)
  })

  test('buy trade has correct shares and amount', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 6, price: 250, amount: 1500, targetShares: 10 },
    ]
    const trades = generateTrades(holdings)
    expect(trades).toHaveLength(1)
    expect(trades[0]!.type).toBe('buy')
    expect(trades[0]!.shares).toBe(4)
    expect(trades[0]!.amount).toBe(1000)
  })

  test('targetShares equal to shares produces no trade', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 10, price: 100, amount: 1000, targetShares: 10 },
    ]
    expect(generateTrades(holdings)).toHaveLength(0)
  })

  test('targetShares: 0 generates sell for all shares', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 25, price: 100, amount: 2500, targetShares: 0 },
    ]
    const trades = generateTrades(holdings)
    expect(trades).toHaveLength(1)
    expect(trades[0]!.type).toBe('sell')
    expect(trades[0]!.shares).toBe(25)
    expect(trades[0]!.amount).toBe(2500)
  })

  test('multiple holdings produce independent trades', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 10, price: 100, amount: 1000, targetShares: 15 },
      { account: 'roth', symbol: 'VXUS', shares: 20, price: 60, amount: 1200, targetShares: 10 },
      { account: 'taxable', symbol: 'BND', shares: 5, price: 80, amount: 400, targetShares: 5 },
    ]
    const trades = generateTrades(holdings)
    // VTI: buy 5, VXUS: sell 10, BND: no trade
    expect(trades).toHaveLength(2)
    const vtiBuy = trades.find(t => t.symbol === 'VTI')!
    const vxusSell = trades.find(t => t.symbol === 'VXUS')!
    expect(vtiBuy.type).toBe('buy')
    expect(vtiBuy.shares).toBe(5)
    expect(vxusSell.type).toBe('sell')
    expect(vxusSell.shares).toBe(10)
  })

  test('amount is rounded to cents', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 0, price: 152.33, amount: 0, targetShares: 3 },
    ]
    const trades = generateTrades(holdings)
    expect(trades[0]!.amount).toBe(456.99)
  })
})

// =======================================================================
// End-to-end: full pipeline tests
// =======================================================================

describe('end-to-end: rebalance → wholeShares → trades', () => {
  test('buy dollar total never exceeds sell total per account (consolidate)', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 263, targetPercent: 50 },
      { name: 'VXUS', price: 58, targetPercent: 30 },
      { name: 'BND', price: 73, targetPercent: 20 },
    ]
    const accounts: Account[] = [{ name: 'roth' }, { name: 'taxable' }]
    const holdings: Holding[] = [
      h('roth', 'VTI', 15, 263),    // $3945
      h('roth', 'BND', 30, 73),     // $2190
      h('taxable', 'VXUS', 80, 58), // $4640
      h('taxable', 'BND', 10, 73),  // $730
    ]

    const result = convertToWholeShares(calculateRebalance(symbols, accounts, holdings))
    const trades = generateTrades(result)

    for (const account of ['roth', 'taxable']) {
      const acctTrades = trades.filter(t => t.account === account)
      const buys = acctTrades.filter(t => t.type === 'buy').reduce((sum, t) => sum + t.amount, 0)
      const sells = acctTrades.filter(t => t.type === 'sell').reduce((sum, t) => sum + t.amount, 0)
      expect(buys).toBeLessThanOrEqual(sells + 0.01)
    }
  })

  test('buy dollar total never exceeds sell total per account (min_trades)', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 263, targetPercent: 50 },
      { name: 'VXUS', price: 58, targetPercent: 30 },
      { name: 'BND', price: 73, targetPercent: 20 },
    ]
    const accounts: Account[] = [{ name: 'roth' }, { name: 'taxable' }]
    const holdings: Holding[] = [
      h('roth', 'VTI', 15, 263),
      h('roth', 'BND', 30, 73),
      h('taxable', 'VXUS', 80, 58),
      h('taxable', 'BND', 10, 73),
    ]

    const result = convertToWholeShares(calculateRebalanceMinTrades(symbols, accounts, holdings))
    const trades = generateTrades(result)

    for (const account of ['roth', 'taxable']) {
      const acctTrades = trades.filter(t => t.account === account)
      const buys = acctTrades.filter(t => t.type === 'buy').reduce((sum, t) => sum + t.amount, 0)
      const sells = acctTrades.filter(t => t.type === 'sell').reduce((sum, t) => sum + t.amount, 0)
      expect(buys).toBeLessThanOrEqual(sells + 0.01)
    }
  })

  test('realistic portfolio with varied prices', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 283.50, targetPercent: 40 },
      { name: 'VXUS', price: 59.20, targetPercent: 20 },
      { name: 'BND', price: 71.80, targetPercent: 15 },
      { name: 'BNDX', price: 48.90, targetPercent: 10 },
      { name: 'VNQ', price: 82.30, targetPercent: 15 },
    ]
    const accounts: Account[] = [
      { name: 'roth' },
      { name: 'trad' },
      { name: 'taxable' },
    ]
    const holdings: Holding[] = [
      h('roth', 'VTI', 30, 283.50),   // $8505
      h('roth', 'VXUS', 100, 59.20),  // $5920
      h('trad', 'BND', 200, 71.80),   // $14360
      h('trad', 'BNDX', 50, 48.90),   // $2445
      h('taxable', 'VTI', 50, 283.50),// $14175
      h('taxable', 'VNQ', 60, 82.30), // $4938
    ]

    for (const fn of [calculateRebalance, calculateRebalanceMinTrades]) {
      const result = convertToWholeShares(fn(symbols, accounts, holdings))
      const trades = generateTrades(result)

      // Per-account: buys never exceed sells
      for (const account of ['roth', 'trad', 'taxable']) {
        const acctTrades = trades.filter(t => t.account === account)
        const buys = acctTrades.filter(t => t.type === 'buy').reduce((sum, t) => sum + t.amount, 0)
        const sells = acctTrades.filter(t => t.type === 'sell').reduce((sum, t) => sum + t.amount, 0)
        expect(buys).toBeLessThanOrEqual(sells + 0.01)
      }

      // All targetShares should be non-negative integers
      for (const r of result) {
        if (r.targetShares !== undefined) {
          expect(r.targetShares).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(r.targetShares)).toBe(true)
        }
      }
    }
  })
})
