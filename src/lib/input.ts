import type { RebalanceInput, Symbol, Account, Holding } from './types'

export function buildSymbols(input: RebalanceInput): Symbol[] {
  const allSymbolNames = new Set<string>()
  input.holdings.forEach(h => allSymbolNames.add(h.symbol))
  if (input.targets) {
    Object.keys(input.targets).forEach(s => allSymbolNames.add(s))
  }

  const metaMap = new Map<string, NonNullable<RebalanceInput['symbols']>[number]>()
  if (input.symbols) {
    input.symbols.forEach(s => metaMap.set(s.name, s))
  }

  return Array.from(allSymbolNames).map(name => {
    const meta = metaMap.get(name)
    return {
      name,
      price: meta?.price ?? 1.0,
      targetPercent: input.targets?.[name] ?? 0,
      countries: meta?.countries ?? {},
      assets: meta?.assets ?? {},
      beta: meta?.beta ?? 1.0,
    }
  })
}

export function buildAccounts(input: RebalanceInput): Account[] {
  const accountNames = new Set<string>()
  input.holdings.forEach(h => accountNames.add(h.account))

  const metaMap = new Map<string, NonNullable<RebalanceInput['accounts']>[number]>()
  if (input.accounts) {
    input.accounts.forEach(a => metaMap.set(a.name, a))
  }

  return Array.from(accountNames).map(name => {
    const meta = metaMap.get(name)
    return {
      name,
      tax_status: meta?.tax_status,
      provider: meta?.provider,
      owner: meta?.owner,
    }
  })
}

export function buildHoldings(input: RebalanceInput, symbols: Symbol[]): Holding[] {
  const priceMap = new Map<string, number>()
  for (const s of symbols) {
    priceMap.set(s.name, s.price)
  }

  return input.holdings.map(h => {
    const price = priceMap.get(h.symbol) ?? 1.0
    return {
      account: h.account,
      symbol: h.symbol,
      shares: h.shares,
      price,
      amount: h.shares * price,
    }
  })
}
