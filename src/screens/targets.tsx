import { useState, useMemo, useEffect } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { Table } from '../components/table'
import { StatusBar } from '../components/status-bar'
import { StepHeader } from '../components/step-header'
import type { Column, Cell } from '../components/table'
import type { StatusBarItem } from '../components/status-bar'
import {
  loadPortfolioAsync,
  loadPortfolioDataAsync,
  savePortfolioAsync,
  roundPercent,
  smartRoundPercentages,
  buildSymbols,
  buildAccounts,
  buildHoldings,
} from './state.ts'
import type { StorageAdapter } from './storage.ts'
import type { RebalanceInput, Symbol, Account, Holding } from '../lib/types.ts'

interface Step3Props {
  dataDir: string
  storage?: StorageAdapter
  onComplete: () => void
  onBack?: () => void
  onReset?: () => void
  portfolioInput?: RebalanceInput | null
  portfolioData?: { symbols: Symbol[]; accounts: Account[]; holdings: Holding[] } | null
  onPortfolioImported?: (input: RebalanceInput, data: { symbols: Symbol[]; accounts: Account[]; holdings: Holding[] }) => void
  extraStatusItems?: StatusBarItem[]
}

interface TargetRow {
  symbol: string
  shares: number
  price: number
  currentPercent: number
  targetPercent: number
}

export function Step3Targets({ dataDir: _dataDir, storage, onComplete, onBack, onReset, portfolioInput: preloadedInput, portfolioData: preloadedData, onPortfolioImported, extraStatusItems }: Step3Props) {
  const { exit } = useApp()

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

  const symbols = loadedData?.symbols ?? []
  const holdings = loadedData?.holdings ?? []
  const portfolioInput = loadedInput

  const totalValue = useMemo(
    () => holdings.reduce((sum, h) => sum + h.amount, 0),
    [holdings]
  )

  // Build current shares and percentages per symbol
  const symbolAgg = useMemo(() => {
    const sharesMap = new Map<string, number>()
    const amtMap = new Map<string, number>()
    for (const h of holdings) {
      sharesMap.set(h.symbol, (sharesMap.get(h.symbol) || 0) + h.shares)
      amtMap.set(h.symbol, (amtMap.get(h.symbol) || 0) + h.amount)
    }
    const result: Record<string, { shares: number; percent: number }> = {}
    for (const [sym, amt] of amtMap) {
      result[sym] = {
        shares: sharesMap.get(sym) || 0,
        percent: totalValue > 0 ? roundPercent((amt / totalValue) * 100) : 0,
      }
    }
    return result
  }, [holdings, totalValue])

  const [rows, setRows] = useState<TargetRow[]>(() =>
    symbols.map(s => ({
      symbol: s.name,
      shares: symbolAgg[s.name]?.shares || 0,
      price: s.price,
      currentPercent: symbolAgg[s.name]?.percent || 0,
      targetPercent: s.targetPercent || 0,
    })).sort((a, b) => b.currentPercent - a.currentPercent)
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [editBuffer, setEditBuffer] = useState(() => rows[0] ? String(rows[0].targetPercent) : '0')
  const [freshSelection, setFreshSelection] = useState(true) // first keystroke replaces buffer

  const targetSum = useMemo(
    () => roundPercent(rows.reduce((sum, r) => sum + r.targetPercent, 0)),
    [rows]
  )
  const isValid = Math.abs(targetSum - 100) < 0.02

  // Populate rows once data finishes loading (useState initializer only runs once with empty data)
  useEffect(() => {
    if (loadedData && rows.length === 0 && symbols.length > 0) {
      const newRows = symbols.map(s => ({
        symbol: s.name,
        shares: symbolAgg[s.name]?.shares || 0,
        price: s.price,
        currentPercent: symbolAgg[s.name]?.percent || 0,
        targetPercent: s.targetPercent || 0,
      })).sort((a, b) => b.currentPercent - a.currentPercent)
      setRows(newRows)
      setEditBuffer(newRows[0] ? String(newRows[0].targetPercent) : '0')
      setSelectedIndex(0)
      setFreshSelection(true)
    }
  }, [loadedData])

  const isLoading = !loadedData || !loadedInput

  const updateRow = (index: number, targetPercent: number) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, targetPercent } : r))
  }

  // Flush the edit buffer into the current row
  const commitBuffer = () => {
    const val = parseFloat(editBuffer)
    if (!isNaN(val) && val >= 0 && val <= 100) {
      updateRow(selectedIndex, roundPercent(val))
    }
  }

  // Commit current, move to a new row, load its value
  const moveTo = (nextIndex: number) => {
    commitBuffer()
    setSelectedIndex(nextIndex)
    setEditBuffer(String(rows[nextIndex]!.targetPercent))
    setFreshSelection(true)
  }

  useInput((input, key) => {
    if (isLoading) return

    if (key.escape) {
      exit()
      return
    }

    // Navigation — commit current value, move, load new buffer
    if (key.upArrow) {
      moveTo((selectedIndex - 1 + rows.length) % rows.length)
      return
    }
    if (key.downArrow) {
      moveTo((selectedIndex + 1) % rows.length)
      return
    }
    if (key.tab) {
      const delta = key.shift ? -1 : 1
      moveTo((selectedIndex + delta + rows.length) % rows.length)
      return
    }

    // Enter — save and continue
    if (key.return) {
      commitBuffer()
      const targets: Record<string, number> = {}
      for (const r of rows) {
        if (r.targetPercent > 0) {
          targets[r.symbol] = r.targetPercent
        }
      }
      // Also include current buffer in case it hasn't flushed to rows yet
      const bufVal = parseFloat(editBuffer)
      if (!isNaN(bufVal) && bufVal >= 0 && bufVal <= 100) {
        const sym = rows[selectedIndex]!.symbol
        if (roundPercent(bufVal) > 0) {
          targets[sym] = roundPercent(bufVal)
        } else {
          delete targets[sym]
        }
      }
      const updated = { ...portfolioInput!, targets }
      savePortfolioAsync(adapter, updated)
      const syms = buildSymbols(updated)
      onPortfolioImported?.(updated, {
        symbols: syms,
        accounts: buildAccounts(updated),
        holdings: buildHoldings(updated, syms),
      })
      onComplete()
      return
    }

    // Back
    if (input === 'b' && onBack) {
      onBack()
      return
    }

    // Editing — digits, dot, backspace
    if (key.backspace || key.delete) {
      setFreshSelection(false)
      setEditBuffer(prev => prev.slice(0, -1))
      return
    }
    if (input && /[\d.]/.test(input)) {
      if (freshSelection) {
        setEditBuffer(input)
        setFreshSelection(false)
      } else {
        setEditBuffer(prev => prev + input)
      }
      return
    }

    // Shortcut keys
    if (input === 'c') {
      const val = rows[selectedIndex]!.currentPercent
      updateRow(selectedIndex, val)
      setEditBuffer(String(val))
      return
    }
    if (input === 'r') {
      const othersSum = rows.reduce((sum, r, i) => i === selectedIndex ? sum : sum + r.targetPercent, 0)
      const remaining = roundPercent(Math.max(0, 100 - othersSum))
      updateRow(selectedIndex, remaining)
      setEditBuffer(String(remaining))
      return
    }
    if (input === 'z' && onReset) {
      onReset()
      return
    }
    if (input === 'a') {
      const currentPcts = rows.map(r => r.currentPercent)
      const rounded = smartRoundPercentages(currentPcts)
      setRows(prev => prev.map((r, i) => ({ ...r, targetPercent: rounded[i]! })))
      setEditBuffer(String(rounded[selectedIndex]!))
      return
    }
  })

  if (isLoading) {
    return <Box paddingX={1}><Text dimColor>Loading...</Text></Box>
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <StepHeader
          step={3}
          totalSteps={4}
          title="Set Target Allocations"
          description=""
        />
      </Box>

      <Table
        columns={(() => {
          const cols: Column[] = [
            { header: '', width: 1, align: 'left' },
            { header: 'Symbol', minWidth: 8, align: 'left' },
            { header: 'Shares', minWidth: 8, align: 'right' },
            { header: 'Current %', minWidth: 9, align: 'right' },
            { header: 'Target %', minWidth: 9, align: 'right' },
            { header: '~Tgt Shares', minWidth: 11, align: 'right' },
          ]
          return cols
        })()}
        rows={rows.map((row, i) => {
          const selected = i === selectedIndex
          const approxTargetShares = row.price > 0
            ? Math.round((row.targetPercent / 100) * totalValue / row.price)
            : 0
          const targetCell: Cell = selected
            ? {
                text: editBuffer + ' ',
                color: 'yellow',
                node: <Text color="yellow">{editBuffer}<Text inverse>{" "}</Text></Text>,
              }
            : {
                text: row.targetPercent.toFixed(2) + '%',
                color: row.targetPercent > 0 ? 'green' : 'white',
              }
          return [
            { text: selected ? '▸' : '' },
            { text: row.symbol, bold: selected },
            { text: String(parseFloat(row.shares.toFixed(2))), dimColor: true },
            { text: row.currentPercent.toFixed(2) + '%', dimColor: true },
            targetCell,
            { text: row.targetPercent > 0 ? String(approxTargetShares) : '', dimColor: true },
          ] as Cell[]
        })}
        footerRows={[
          [
            { text: '' },
            { text: 'Total', bold: true },
            { text: '' },
            { text: '100.00%', dimColor: true },
            { text: targetSum.toFixed(2) + '%', bold: true, color: isValid ? 'green' : 'red' },
            { text: '' },
          ],
        ]}
      />

      {/* Status */}
      <Box marginTop={1} flexDirection="column">
        <StatusBar
          items={[
            { key: '↑↓', label: 'navigate' },
            { key: 'c', label: 'current' },
            { key: 'r', label: 'remaining' },
            { key: 'a', label: 'all to current' },
            ...(onBack ? [{ key: 'b', label: 'back' }] : []),
            ...(onReset ? [{ key: 'z', label: 'reset' }] : []),
            ...(extraStatusItems ?? []),
            ...(isValid ? [{ key: '⏎', label: 'continue' }] : []),
          ] as StatusBarItem[]}
        />
        {isValid && (
          <Text color="green" bold>Targets sum to 100%.</Text>
        )}
        {!isValid && targetSum > 0 && (
          <Text color="yellow">Targets must sum to 100% (currently {targetSum.toFixed(2)}%)</Text>
        )}
      </Box>
    </Box>
  )
}
