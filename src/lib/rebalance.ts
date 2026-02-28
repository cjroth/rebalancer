import type { Account, Holding, Symbol } from './types'

/**
 * Converts dollar-based targetAmounts to whole-share targetShares using largest-remainder method.
 * Groups holdings by symbol and distributes whole shares to minimize rounding error.
 */
export function convertToWholeShares(holdings: Holding[]): Holding[] {
  // Group holdings by symbol
  const bySymbol = new Map<string, Holding[]>()
  for (const h of holdings) {
    if (!bySymbol.has(h.symbol)) bySymbol.set(h.symbol, [])
    bySymbol.get(h.symbol)!.push(h)
  }

  // Track floor of ideal shares per result index so we know which were rounded up
  const result: Holding[] = []
  const floorOfIdeal: number[] = []

  for (const [, group] of bySymbol) {
    const price = group[0]!.price

    // Compute ideal fractional shares for each holding
    const ideals = group.map(h => {
      const ideal = h.targetAmount !== undefined ? h.targetAmount / price : h.shares
      return { holding: h, ideal, floored: Math.floor(ideal), remainder: ideal - Math.floor(ideal) }
    })

    // Total whole shares available = sum of floored
    const totalIdeal = ideals.reduce((sum, i) => sum + i.ideal, 0)
    const totalFloored = ideals.reduce((sum, i) => sum + i.floored, 0)
    const extraShares = Math.round(totalIdeal) - totalFloored

    // Distribute extra shares to holdings with largest remainders
    const sorted = ideals.map((item, idx) => ({ ...item, idx }))
      .sort((a, b) => b.remainder - a.remainder)

    for (let i = 0; i < extraShares; i++) {
      sorted[i]!.floored += 1
    }

    // Rebuild holdings with targetShares
    for (const item of sorted) {
      const h = item.holding
      const targetShares = item.floored
      result.push({
        ...h,
        targetShares,
        targetAmount: targetShares * price,
      })
      floorOfIdeal.push(Math.floor(item.ideal))
    }
  }

  // Post-processing: ensure no account's target total exceeds its original total.
  // Rounding up multiple holdings in one account can push it over budget.
  // Only enforce when the pre-rounding targets respected the budget.
  const accountBudget = new Map<string, number>()
  const accountPreRounding = new Map<string, number>()
  for (const h of holdings) {
    accountBudget.set(h.account, (accountBudget.get(h.account) || 0) + h.amount)
    accountPreRounding.set(h.account, (accountPreRounding.get(h.account) || 0) + (h.targetAmount ?? h.amount))
  }

  let changed = true
  while (changed) {
    changed = false

    const accountTarget = new Map<string, number>()
    for (const h of result) {
      accountTarget.set(h.account, (accountTarget.get(h.account) || 0) + (h.targetShares ?? h.shares) * h.price)
    }

    for (const [account, budget] of accountBudget) {
      const preRounding = accountPreRounding.get(account) || 0
      // Only fix accounts where pre-rounding was within budget but rounding pushed it over
      if (preRounding > budget + 0.01) continue

      const target = accountTarget.get(account) || 0
      if (target > budget + 0.01) {
        // Find the best holding to reduce: prefer ones rounded up (targetShares > floor),
        // then pick the smallest price to minimize uninvested cash.
        let bestIdx = -1
        let bestPrice = Infinity
        let bestWasRoundedUp = false

        for (let i = 0; i < result.length; i++) {
          const h = result[i]!
          if (h.account !== account || h.targetShares === undefined || h.targetShares <= 0) continue

          const wasRoundedUp = h.targetShares > floorOfIdeal[i]!
          // Prefer rounded-up holdings; among same category, prefer smallest price
          if (wasRoundedUp && !bestWasRoundedUp) {
            bestIdx = i
            bestPrice = h.price
            bestWasRoundedUp = true
          } else if (wasRoundedUp === bestWasRoundedUp && h.price < bestPrice) {
            bestIdx = i
            bestPrice = h.price
          }
        }

        if (bestIdx >= 0) {
          const h = result[bestIdx]!
          h.targetShares = h.targetShares! - 1
          h.targetAmount = h.targetShares * h.price
          changed = true
        }
      }
    }
  }

  return result
}

/**
 * Calculates target amounts for each holding to match desired symbol allocations.
 * Strategy: Consolidate each symbol into as few accounts as possible (greedy allocation).
 * Constraint: Each account's total dollar amount cannot change.
 */
export function calculateRebalance(symbols: Symbol[], _accounts: Account[], holdings: Holding[]): Holding[] {
  const totalValue = holdings.reduce((sum, h) => sum + h.amount, 0)

  const priceMap = new Map<string, number>()
  for (const s of symbols) priceMap.set(s.name, s.price)

  const accountTotals = new Map<string, number>()
  holdings.forEach((holding) => {
    const current = accountTotals.get(holding.account) || 0
    accountTotals.set(holding.account, current + holding.amount)
  })

  const allAccounts = Array.from(accountTotals.keys())

  const symbolTargets = new Map<string, number>()
  symbols.forEach((symbol) => {
    if (symbol.targetPercent && symbol.targetPercent > 0) {
      symbolTargets.set(symbol.name, totalValue * (symbol.targetPercent / 100))
    }
  })

  const accountCapacity = new Map<string, number>()
  allAccounts.forEach(account => {
    accountCapacity.set(account, accountTotals.get(account) || 0)
  })

  const allocations = new Map<string, number>()

  const symbolsWithTargets = Array.from(symbolTargets.entries())
    .sort((a, b) => b[1] - a[1])

  symbolsWithTargets.forEach(([symbolName, totalNeeded]) => {
    let remaining = totalNeeded

    const accountsByCapacity = allAccounts
      .map(name => ({ name, capacity: accountCapacity.get(name) || 0 }))
      .filter(a => a.capacity > 0)
      .sort((a, b) => b.capacity - a.capacity)

    for (const account of accountsByCapacity) {
      if (remaining <= 0) break

      const canAllocate = Math.min(remaining, account.capacity)

      if (canAllocate > 0) {
        allocations.set(`${symbolName}:${account.name}`, canAllocate)
        accountCapacity.set(account.name, account.capacity - canAllocate)
        remaining -= canAllocate
      }
    }
  })

  const result: Holding[] = []

  allAccounts.forEach((accountName) => {
    symbols.forEach((symbol) => {
      const key = `${symbol.name}:${accountName}`
      const targetAmount = allocations.get(key) || 0

      const existingHolding = holdings.find(
        h => h.symbol === symbol.name && h.account === accountName
      )

      if (symbol.targetPercent !== undefined) {
        const price = priceMap.get(symbol.name) ?? 1
        result.push({
          symbol: symbol.name,
          account: accountName,
          shares: existingHolding?.shares || 0,
          price,
          amount: existingHolding?.amount || 0,
          targetAmount: targetAmount,
        })
      }
    })

    holdings.forEach((holding) => {
      if (holding.account === accountName) {
        const symbol = symbols.find(s => s.name === holding.symbol)
        if (!symbol?.targetPercent && symbol?.targetPercent !== 0) {
          result.push({
            symbol: holding.symbol,
            account: accountName,
            shares: holding.shares,
            price: holding.price,
            amount: holding.amount,
            targetAmount: 0,
          })
        }
      }
    })
  })

  return result
}

/**
 * Validates that target percentages sum to 100%
 */
export function calculateTargetPercentSum(symbols: Symbol[]): number {
  return symbols.reduce((sum, symbol) => {
    return sum + (symbol.targetPercent || 0)
  }, 0)
}

/**
 * Checks if target percentages are valid (sum to 100%)
 */
export function isTargetPercentValid(symbols: Symbol[], tolerance: number = 0.01): boolean {
  const sum = calculateTargetPercentSum(symbols)
  return Math.abs(sum - 100) < tolerance
}

/**
 * Calculates target amounts for each holding to match desired symbol allocations.
 * Strategy: Minimize number of trades by making targeted changes to specific positions.
 * Constraint: Each account's total dollar amount cannot change.
 */
export function calculateRebalanceMinTrades(symbols: Symbol[], _accounts: Account[], holdings: Holding[]): Holding[] {
  const totalValue = holdings.reduce((sum, h) => sum + h.amount, 0)

  const priceMap = new Map<string, number>()
  for (const s of symbols) priceMap.set(s.name, s.price)

  const accountTotals = new Map<string, number>()
  holdings.forEach((holding) => {
    const current = accountTotals.get(holding.account) || 0
    accountTotals.set(holding.account, current + holding.amount)
  })

  const allAccounts = Array.from(accountTotals.keys())

  const symbolTargets = new Map<string, number>()
  symbols.forEach((symbol) => {
    if (symbol.targetPercent !== undefined) {
      symbolTargets.set(symbol.name, totalValue * (symbol.targetPercent / 100))
    }
  })

  const allocations = new Map<string, number>()
  holdings.forEach((holding) => {
    const symbol = symbols.find(s => s.name === holding.symbol)
    if (symbol?.targetPercent !== undefined) {
      const key = `${holding.symbol}:${holding.account}`
      allocations.set(key, holding.amount)
    }
  })

  const symbolDeltas = Array.from(symbolTargets.entries()).map(([symbolName, targetAmount]) => {
    const currentTotal = holdings
      .filter(h => h.symbol === symbolName)
      .reduce((sum, h) => sum + h.amount, 0)
    return {
      symbolName,
      targetAmount,
      currentTotal,
      delta: targetAmount - currentTotal
    }
  }).sort((a, b) => a.delta - b.delta)

  symbolDeltas.forEach(({ symbolName, targetAmount }) => {
    const symbolHoldings = holdings
      .filter(h => h.symbol === symbolName && h.amount > 0)
      .map(h => ({
        account: h.account,
        amount: h.amount,
        key: `${symbolName}:${h.account}`
      }))
      .sort((a, b) => a.amount - b.amount)

    const currentTotal = symbolHoldings.reduce((sum, h) => sum + h.amount, 0)
    const delta = targetAmount - currentTotal

    // Skip if delta is below meaningful trade threshold:
    // - symbolPrice: can't trade less than 1 whole share
    // - 0.02% of portfolio: covers percentage rounding noise (2-decimal precision)
    const symbolPrice = priceMap.get(symbolName) ?? 1
    const noiseThreshold = totalValue * 0.0002
    if (Math.abs(delta) < Math.max(symbolPrice, noiseThreshold)) {
      return
    }

    if (delta < 0) {
      let remaining = Math.abs(delta)

      for (const holding of symbolHoldings) {
        if (remaining <= 0) break

        const toRemove = Math.min(remaining, holding.amount)
        const newAmount = holding.amount - toRemove

        allocations.set(holding.key, newAmount)
        remaining -= toRemove
      }
    } else {
      let remaining = delta

      const sortedHoldings = [...symbolHoldings].sort((a, b) => b.amount - a.amount)

      for (const holding of sortedHoldings) {
        if (remaining <= 0) break

        const accountTotal = accountTotals.get(holding.account) || 0
        const currentAccountUsed = Array.from(allocations.entries())
          .filter(([key]) => key.endsWith(`:${holding.account}`))
          .reduce((sum, [, amt]) => sum + amt, 0)

        const availableCapacity = accountTotal - currentAccountUsed

        if (availableCapacity > 1) {
          const canAdd = Math.min(remaining, availableCapacity)
          allocations.set(holding.key, holding.amount + canAdd)
          remaining -= canAdd
        }
      }

      if (remaining > 1) {
        const accountsWithCapacity = allAccounts
          .map(name => {
            const accountTotal = accountTotals.get(name) || 0
            const currentUsed = Array.from(allocations.entries())
              .filter(([key]) => key.endsWith(`:${name}`))
              .reduce((sum, [, amt]) => sum + amt, 0)
            return { name, capacity: accountTotal - currentUsed }
          })
          .filter(a => a.capacity > 1)
          .sort((a, b) => b.capacity - a.capacity)

        for (const { name } of accountsWithCapacity) {
          if (remaining <= 0) break

          const key = `${symbolName}:${name}`
          const currentAmount = allocations.get(key) || 0
          const accountTotal = accountTotals.get(name) || 0
          const currentUsed = Array.from(allocations.entries())
            .filter(([k]) => k.endsWith(`:${name}`))
            .reduce((sum, [, amt]) => sum + amt, 0)
          const availableCapacity = accountTotal - currentUsed

          if (availableCapacity > 1) {
            const canAdd = Math.min(remaining, availableCapacity)
            allocations.set(key, currentAmount + canAdd)
            remaining -= canAdd
          }
        }
      }
    }
  })

  allAccounts.forEach(account => {
    const targetTotal = accountTotals.get(account) || 0
    const currentTotal = Array.from(allocations.entries())
      .filter(([key]) => key.endsWith(`:${account}`))
      .reduce((sum, [, amt]) => sum + amt, 0)

    const delta = targetTotal - currentTotal

    if (Math.abs(delta) < 1) return

    const accountSymbols = Array.from(allocations.entries())
      .filter(([key, amt]) => key.endsWith(`:${account}`) && amt > 0)
      .map(([key, amt]) => {
        const [symbol] = key.split(':')
        return { symbol, key, amount: amt }
      })

    if (accountSymbols.length === 0) return

    const accountSymbolTotal = accountSymbols.reduce((sum, s) => sum + s.amount, 0)

    accountSymbols.forEach(({ key, amount }) => {
      const proportion = amount / accountSymbolTotal
      const adjustment = delta * proportion
      allocations.set(key, Math.max(0, amount + adjustment))
    })
  })

  symbolTargets.forEach((targetAmount, symbolName) => {
    const currentTotal = Array.from(allocations.entries())
      .filter(([key]) => key.startsWith(`${symbolName}:`))
      .reduce((sum, [, amount]) => sum + amount, 0)

    if (currentTotal < 1) {
      const accountsWithCapacity = allAccounts
        .map(name => {
          const accountTotal = accountTotals.get(name) || 0
          const currentUsed = Array.from(allocations.entries())
            .filter(([key]) => key.endsWith(`:${name}`))
            .reduce((sum, [, amt]) => sum + amt, 0)
          return { name, capacity: accountTotal - currentUsed }
        })
        .filter(a => a.capacity > 1)
        .sort((a, b) => b.capacity - a.capacity)

      let remaining = targetAmount
      for (const { name, capacity } of accountsWithCapacity) {
        if (remaining <= 0) break

        const canAllocate = Math.min(remaining, capacity)
        const key = `${symbolName}:${name}`
        allocations.set(key, canAllocate)
        remaining -= canAllocate
      }
    }
  })

  const result: Holding[] = []

  allAccounts.forEach((accountName) => {
    symbols.forEach((symbol) => {
      const key = `${symbol.name}:${accountName}`
      const targetAmount = allocations.get(key) || 0

      const existingHolding = holdings.find(
        h => h.symbol === symbol.name && h.account === accountName
      )

      if (symbol.targetPercent !== undefined) {
        const price = priceMap.get(symbol.name) ?? 1
        result.push({
          symbol: symbol.name,
          account: accountName,
          shares: existingHolding?.shares || 0,
          price,
          amount: existingHolding?.amount || 0,
          targetAmount: targetAmount,
        })
      }
    })

    holdings.forEach((holding) => {
      if (holding.account === accountName) {
        const symbol = symbols.find(s => s.name === holding.symbol)
        if (!symbol?.targetPercent && symbol?.targetPercent !== 0) {
          result.push({
            symbol: holding.symbol,
            account: accountName,
            shares: holding.shares,
            price: holding.price,
            amount: holding.amount,
            targetAmount: 0,
          })
        }
      }
    })
  })

  return result
}
