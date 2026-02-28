import type { Holding, Trade, TableData, SymbolDimensionType, AccountDimensionType } from './types'

function formatUSD(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Formats trades into a markdown table grouped by account.
 */
export function formatTradesMarkdown(
  trades: Trade[],
  holdings: Holding[],
  strategy: 'consolidate' | 'min_trades'
): string {
  const totalValue = holdings.reduce((sum, h) => sum + h.amount, 0)
  const strategyLabel = strategy === 'min_trades' ? 'Minimize Trades' : 'Consolidate'

  if (trades.length === 0) {
    return `## Portfolio Rebalance\n\n**Total Portfolio:** ${formatUSD(totalValue)} | **Strategy:** ${strategyLabel}\n\nNo trades needed - portfolio is already balanced.`
  }

  // Sort trades: by account, then sells before buys, then by amount descending
  const sorted = [...trades].sort((a, b) => {
    if (a.account !== b.account) return a.account.localeCompare(b.account)
    if (a.type !== b.type) return a.type === 'sell' ? -1 : 1
    return b.amount - a.amount
  })

  const lines: string[] = []
  lines.push(`## Portfolio Rebalance`)
  lines.push('')
  lines.push(`**Total Portfolio:** ${formatUSD(totalValue)} | **Strategy:** ${strategyLabel}`)
  lines.push('')
  lines.push('| Account | Symbol | Action | Shares | Amount |')
  lines.push('|---------|--------|--------|-------:|-------:|')

  for (const trade of sorted) {
    const action = trade.type.toUpperCase()
    lines.push(`| ${trade.account} | ${trade.symbol} | ${action} | ${parseFloat(trade.shares.toFixed(2))} | ${formatUSD(trade.amount)} |`)
  }

  // Summary
  const buys = trades.filter(t => t.type === 'buy')
  const sells = trades.filter(t => t.type === 'sell')
  const buyTotal = buys.reduce((sum, t) => sum + t.amount, 0)
  const sellTotal = sells.reduce((sum, t) => sum + t.amount, 0)
  const buyShares = buys.reduce((sum, t) => sum + t.shares, 0)
  const sellShares = sells.reduce((sum, t) => sum + t.shares, 0)

  lines.push('')
  lines.push(`**Sells:** ${sells.length} trade${sells.length !== 1 ? 's' : ''} (${parseFloat(sellShares.toFixed(2))} shares, ${formatUSD(sellTotal)}) | **Buys:** ${buys.length} trade${buys.length !== 1 ? 's' : ''} (${parseFloat(buyShares.toFixed(2))} shares, ${formatUSD(buyTotal)})`)

  return lines.join('\n')
}

/**
 * Formats current holdings as a markdown summary table.
 */
export function formatHoldingsMarkdown(holdings: Holding[]): string {
  const totalValue = holdings.reduce((sum, h) => sum + h.amount, 0)

  // Group by account
  const byAccount = new Map<string, { symbol: string; shares: number; amount: number }[]>()
  for (const h of holdings) {
    if (!byAccount.has(h.account)) byAccount.set(h.account, [])
    byAccount.get(h.account)!.push({ symbol: h.symbol, shares: h.shares, amount: h.amount })
  }

  const lines: string[] = []
  lines.push(`## Current Holdings`)
  lines.push('')
  lines.push(`**Total Portfolio:** ${formatUSD(totalValue)}`)
  lines.push('')
  lines.push('| Account | Symbol | Shares | Amount | % of Portfolio |')
  lines.push('|---------|--------|-------:|-------:|---------------:|')

  for (const [account, items] of byAccount) {
    const sorted = items.sort((a, b) => b.amount - a.amount)
    for (const item of sorted) {
      const pct = ((item.amount / totalValue) * 100).toFixed(1)
      lines.push(`| ${account} | ${item.symbol} | ${item.shares} | ${formatUSD(item.amount)} | ${pct}% |`)
    }
  }

  return lines.join('\n')
}

const dimensionLabels: Record<SymbolDimensionType | AccountDimensionType, string> = {
  symbol: 'Symbol',
  countries: 'Country',
  assets: 'Asset Class',
  beta: 'Beta',
  account: 'Account',
  tax_status: 'Tax Status',
  provider: 'Provider',
  owner: 'Owner',
}

/**
 * Formats TableData as a markdown grid table.
 */
export function formatTableMarkdown(
  tableData: TableData,
  rowDimension: SymbolDimensionType,
  colDimension: AccountDimensionType
): string {
  const { rows, cols, cells } = tableData
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)

  if (grandTotal === 0) {
    return '## Current Portfolio\n\nNo holdings data.'
  }

  const fmtPctAmt = (value: number) => {
    const pct = ((value / grandTotal) * 100).toFixed(1)
    return `${pct}% ${formatUSD(value)}`
  }

  const rowLabel = dimensionLabels[rowDimension]
  const colLabel = dimensionLabels[colDimension]

  const lines: string[] = []
  lines.push('## Current Portfolio')
  lines.push('')
  lines.push(`**Total:** ${formatUSD(grandTotal)} | **View:** ${rowLabel} × ${colLabel}`)
  lines.push('')

  // Header row
  const headers = ['', ...cols.map(c => c.label), 'Total']
  lines.push('| ' + headers.join(' | ') + ' |')

  // Separator - first col left-aligned, rest right-aligned
  const seps = headers.map((_, i) => i === 0 ? '---' : '---:')
  lines.push('| ' + seps.join(' | ') + ' |')

  // Data rows
  for (const row of rows) {
    const cellValues = cols.map(col => {
      const cell = cells.get(`${row.key}:${col.key}`)
      return cell && cell.value > 0 ? fmtPctAmt(cell.value) : ''
    })
    lines.push(`| ${row.label} | ${cellValues.join(' | ')} | ${fmtPctAmt(row.total)} |`)
  }

  // Totals row
  const colTotalValues = cols.map(col => fmtPctAmt(col.total))
  lines.push(`| **Total** | ${colTotalValues.join(' | ')} | ${fmtPctAmt(grandTotal)} |`)

  return lines.join('\n')
}
