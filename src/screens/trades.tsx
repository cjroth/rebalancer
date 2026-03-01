import { useEffect, useMemo, useState } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { Table as DataTable } from '../components/table'
import { StatusBar } from '../components/status-bar'
import { StepHeader } from '../components/step-header'
import type { Cell } from '../components/table'
import type { StatusBarItem } from '../components/status-bar'
import {
  loadPortfolioAsync,
  loadPortfolioDataAsync,
  formatTradesCsv,
} from './state.ts'
import { calculateRebalance, calculateRebalanceMinTrades, convertToWholeShares } from '../lib/rebalance.ts'
import { generateTrades } from '../lib/trades.ts'
import { computeTableData } from '../lib/table.ts'
import { DimSelector } from '../tui/DimSelector.tsx'
import { Table } from '../tui/Table.tsx'
import type { Holding, RebalanceInput, Symbol, Account } from '../lib/types'
import type { StorageAdapter } from './storage.ts'

interface Step4Props {
  dataDir: string
  storage?: StorageAdapter
  onComplete: () => void
  onBack?: () => void
  onReset?: () => void
  portfolioInput?: RebalanceInput | null
  portfolioData?: { symbols: Symbol[]; accounts: Account[]; holdings: Holding[] } | null
  extraStatusItems?: StatusBarItem[]
}

const STRATEGIES = ['Minimize Trades', 'Consolidate'] as const
const VIEWS = ['Trades', 'Final Balances'] as const

type Focus = 'strategy' | 'view'

function formatUSD(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function Step4Trades({ dataDir, storage, onComplete, onBack, onReset, portfolioInput: preloadedInput, portfolioData: preloadedData, extraStatusItems }: Step4Props) {
  const { exit: _exit } = useApp()

  const adapter = storage!

  const [loadedData, setLoadedData] = useState(preloadedData ?? null)
  const [loadedInput, setLoadedInput] = useState(preloadedInput ?? null)

  useEffect(() => {
    if (!loadedData) {
      loadPortfolioDataAsync(adapter).then(setLoadedData)
    }
    if (!loadedInput) {
      loadPortfolioAsync(adapter).then(setLoadedInput)
    }
  }, [])

  const [strategyIndex, setStrategyIndex] = useState(() =>
    loadedInput?.strategy === 'consolidate' ? 1 : 0
  )
  const [viewIndex, setViewIndex] = useState(0)
  const [focus, setFocus] = useState<Focus>('strategy')

  const symbols = loadedData?.symbols
  const accounts = loadedData?.accounts
  const holdings = loadedData?.holdings

  const strategy = strategyIndex === 0 ? 'min_trades' : 'consolidate' as const

  const { trades, rebalancedHoldings } = useMemo(() => {
    if (!symbols || !accounts || !holdings) return { trades: [], rebalancedHoldings: [] as Holding[] }
    const rebalanceFn = strategy === 'min_trades' ? calculateRebalanceMinTrades : calculateRebalance
    const rebalancedHoldings = convertToWholeShares(
      rebalanceFn(symbols, accounts, holdings)
    )
    const trades = generateTrades(rebalancedHoldings)
    return { trades, rebalancedHoldings }
  }, [symbols, accounts, holdings, strategy])

  // Write trades.csv
  useMemo(() => {
    if (trades.length > 0) {
      const csv = formatTradesCsv(trades)
      adapter.write('trades.csv', csv)
    }
  }, [trades, adapter])

  const totalValue = holdings?.reduce((sum, h) => sum + h.amount, 0) ?? 0

  // Sort: sells first, then buys, by amount descending
  const sorted = useMemo(() => {
    return [...trades].sort((a, b) => {
      if (a.account !== b.account) return a.account.localeCompare(b.account)
      if (a.type !== b.type) return a.type === 'sell' ? -1 : 1
      return b.amount - a.amount
    })
  }, [trades])

  const buys = trades.filter(t => t.type === 'buy')
  const sells = trades.filter(t => t.type === 'sell')
  const buyTotal = buys.reduce((sum, t) => sum + t.amount, 0)
  const sellTotal = sells.reduce((sum, t) => sum + t.amount, 0)
  const buyShares = buys.reduce((sum, t) => sum + t.shares, 0)
  const sellShares = sells.reduce((sum, t) => sum + t.shares, 0)

  // Final balances view: synthetic holdings with target amounts
  const finalBalancesData = useMemo(() => {
    if (!symbols || !accounts) return { tableData: { rows: [], cols: [], cells: new Map() }, grandTotal: 0 }
    const syntheticHoldings: Holding[] = rebalancedHoldings.map(h => ({
      ...h,
      amount: h.targetAmount ?? h.amount,
      shares: h.targetShares ?? h.shares,
    }))
    const tableData = computeTableData(symbols, accounts, syntheticHoldings, 'symbol', 'account')
    const grandTotal = tableData.rows.reduce((sum, r) => sum + r.total, 0)
    return { tableData, grandTotal }
  }, [rebalancedHoldings, symbols, accounts])

  useInput((input, key) => {
    if (key.tab || key.downArrow) {
      setFocus(f => f === 'strategy' ? 'view' : 'strategy')
      return
    }
    if (key.upArrow) {
      setFocus(f => f === 'strategy' ? 'view' : 'strategy')
      return
    }
    if (key.leftArrow || key.rightArrow) {
      const delta = key.rightArrow ? 1 : -1
      if (focus === 'strategy') {
        setStrategyIndex(i => (i + delta + STRATEGIES.length) % STRATEGIES.length)
      } else {
        setViewIndex(i => (i + delta + VIEWS.length) % VIEWS.length)
      }
      return
    }
    if (input === 'z' && onReset) {
      onReset()
      return
    }
    if (input === 'b' && onBack) {
      onBack()
      return
    }
    if (key.return || input === 'q' || key.escape) {
      onComplete()
    }
  })

  if (!loadedData || !loadedInput) {
    return <Box paddingX={1}><Text dimColor>Loading...</Text></Box>
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <StepHeader
          step={4}
          totalSteps={4}
          title="Review Trades"
          description=""
        />
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text color="cyan">{focus === 'strategy' ? ' ▸ ' : '   '}</Text>
          <DimSelector
            label="Strategy"
            labelWidth={8}
            options={[...STRATEGIES]}
            selectedIndex={strategyIndex}
            focused={focus === 'strategy'}
          />
        </Box>
        <Box>
          <Text color="cyan">{focus === 'view' ? ' ▸ ' : '   '}</Text>
          <DimSelector
            label="View"
            labelWidth={8}
            options={[...VIEWS]}
            selectedIndex={viewIndex}
            focused={focus === 'view'}
          />
        </Box>
      </Box>

      {viewIndex === 0 ? (
        <>
          <Text>Portfolio: {formatUSD(totalValue)}</Text>

          {trades.length === 0 ? (
            <Box marginTop={1}>
              <Text color="green">No trades needed — portfolio is already balanced.</Text>
            </Box>
          ) : (
            <>
              <DataTable
                columns={[
                  { header: 'Account', align: 'left' },
                  { header: 'Symbol', align: 'left' },
                  { header: 'Action', align: 'left' },
                  { header: 'Shares', align: 'right' },
                  { header: 'Amount', align: 'right' },
                ]}
                rows={sorted.map(trade => [
                  { text: trade.account },
                  { text: trade.symbol },
                  { text: trade.type.toUpperCase(), color: trade.type === 'sell' ? 'red' : 'green' },
                  { text: String(parseFloat(trade.shares.toFixed(2))) },
                  { text: formatUSD(trade.amount) },
                ] as Cell[])}
              />
              <Text>
                Sells: {sells.length} ({parseFloat(sellShares.toFixed(2))} shares, {formatUSD(sellTotal)}) | Buys: {buys.length} ({parseFloat(buyShares.toFixed(2))} shares, {formatUSD(buyTotal)})
              </Text>
            </>
          )}

          {trades.length > 0 && (
            <Box marginTop={1}>
              <Text dimColor>
                {storage ? 'Trades saved to browser storage' : `Trades written to ${dataDir}/trades.csv`}
              </Text>
            </Box>
          )}
        </>
      ) : (
        <Box marginBottom={1}>
          <Table tableData={finalBalancesData.tableData} grandTotal={finalBalancesData.grandTotal} />
        </Box>
      )}

      <Box marginTop={1}>
        <StatusBar
          items={[
            { key: '↑↓←→', label: 'navigate' },
            ...(onBack ? [{ key: 'b', label: 'back' }] : []),
            ...(onReset ? [{ key: 'z', label: 'reset' }] : []),
            ...(extraStatusItems ?? []),
            { key: '⏎/q', label: 'exit' },
          ] as StatusBarItem[]}
        />
      </Box>
    </Box>
  )
}
