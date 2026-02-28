import type { Holding, Trade } from './types'

/**
 * Generates a list of trades from holdings that have targetShares set.
 * Each trade represents a buy or sell action needed to reach the target allocation.
 */
export function generateTrades(holdings: Holding[]): Trade[] {
  const trades: Trade[] = []

  holdings.forEach((holding) => {
    if (holding.targetShares === undefined) {
      return
    }

    const deltaShares = Math.round(holding.targetShares - holding.shares)

    if (deltaShares === 0) {
      return
    }

    const absShares = Math.abs(deltaShares)
    trades.push({
      account: holding.account,
      symbol: holding.symbol,
      type: deltaShares > 0 ? 'buy' : 'sell',
      shares: absShares,
      amount: Math.round(absShares * holding.price * 100) / 100,
    })
  })

  return trades
}
