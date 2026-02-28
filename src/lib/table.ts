import type {
  Symbol, Account, Holding,
  SymbolDimensionType, AccountDimensionType,
  TableData, RowGroup, ColGroup, TableCell,
} from './types'

function getBetaRange(beta: number): string {
  if (beta < 0.5) return 'low'
  if (beta < 1.0) return 'medium'
  return 'high'
}

function formatBetaLabel(range: string): string {
  return `Beta: ${range.charAt(0).toUpperCase() + range.slice(1)}`
}

export function computeTableData(
  symbols: Symbol[],
  accounts: Account[],
  holdings: Holding[],
  rowDimension: SymbolDimensionType,
  colDimension: AccountDimensionType
): TableData {
  const symbolMap = new Map(symbols.map(s => [s.name, s]))
  const holdingMap = new Map(
    holdings.map(h => [`${h.symbol}:${h.account}`, h.amount])
  )

  // Group symbols by row dimension
  const symbolGroups = new Map<string, Set<string>>()

  if (rowDimension === 'symbol') {
    symbols.forEach(symbol => {
      symbolGroups.set(symbol.name, new Set([symbol.name]))
    })
  } else if (rowDimension === 'beta') {
    symbols.forEach(symbol => {
      const range = getBetaRange(symbol.beta ?? 1.0)
      if (!symbolGroups.has(range)) symbolGroups.set(range, new Set())
      symbolGroups.get(range)!.add(symbol.name)
    })
  } else {
    // Compositional dimensions (countries, assets)
    symbols.forEach(symbol => {
      const dimensions = (symbol[rowDimension] ?? {}) as Record<string, number>
      Object.keys(dimensions).forEach(key => {
        if (!symbolGroups.has(key)) symbolGroups.set(key, new Set())
        symbolGroups.get(key)!.add(symbol.name)
      })
    })
  }

  // Group accounts by column dimension
  const accountGroups = new Map<string, Set<string>>()

  if (colDimension === 'account') {
    accounts.forEach(account => {
      accountGroups.set(account.name, new Set([account.name]))
    })
  } else {
    accounts.forEach(account => {
      const key = account[colDimension] as string | undefined
      if (key) {
        if (!accountGroups.has(key)) accountGroups.set(key, new Set())
        accountGroups.get(key)!.add(account.name)
      }
    })
  }

  // Build child cells (actual holdings, not weighted)
  const childCells = new Map<string, TableCell>()
  holdings.forEach(holding => {
    childCells.set(`${holding.symbol}:${holding.account}`, { value: holding.amount })
  })

  // Calculate cell values and totals
  const cells = new Map<string, TableCell>()
  const rowTotals = new Map<string, number>()
  const colTotals = new Map<string, number>()

  symbolGroups.forEach((symbolsInGroup, rowKey) => {
    accountGroups.forEach((accountsInGroup, colKey) => {
      let total = 0

      symbolsInGroup.forEach(symbolName => {
        accountsInGroup.forEach(accountName => {
          const holdingAmount = holdingMap.get(`${symbolName}:${accountName}`) || 0

          if (holdingAmount > 0) {
            const symbol = symbolMap.get(symbolName)!
            let effectiveAmount = holdingAmount

            // Apply compositional weighting for row dimension
            if (rowDimension !== 'symbol' && rowDimension !== 'beta') {
              const dimensions = (symbol[rowDimension] ?? {}) as Record<string, number>
              const weight = dimensions[rowKey] || 0
              effectiveAmount = holdingAmount * weight
            }

            total += effectiveAmount
          }
        })
      })

      if (total > 0) {
        cells.set(`${rowKey}:${colKey}`, { value: total })
        rowTotals.set(rowKey, (rowTotals.get(rowKey) || 0) + total)
        colTotals.set(colKey, (colTotals.get(colKey) || 0) + total)
      }
    })
  })

  // Build sorted row groups
  const rows: RowGroup[] = Array.from(symbolGroups.entries())
    .map(([key, symbolSet]) => {
      const syms = Array.from(symbolSet)
      const isGrouped = rowDimension !== 'symbol'

      let label = key
      if (rowDimension === 'beta') {
        label = formatBetaLabel(key)
      } else if (rowDimension !== 'symbol') {
        label = key.charAt(0).toUpperCase() + key.slice(1)
      }

      return {
        key,
        label,
        total: rowTotals.get(key) || 0,
        symbols: isGrouped ? syms : undefined,
      }
    })
    .filter(row => row.total > 0)
    .sort((a, b) => b.total - a.total)

  // Build sorted column groups
  const cols: ColGroup[] = Array.from(accountGroups.entries())
    .map(([key, accountSet]) => {
      const accts = Array.from(accountSet)
      const isGrouped = colDimension !== 'account'

      let label = key
      if (colDimension !== 'account') {
        label = key.charAt(0).toUpperCase() + key.slice(1)
      }

      return {
        key,
        label,
        total: colTotals.get(key) || 0,
        accounts: isGrouped ? accts : undefined,
      }
    })
    .filter(col => col.total > 0)
    .sort((a, b) => b.total - a.total)

  return { rows, cols, cells, childCells }
}
