import { useState, useMemo } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { DimSelector } from './DimSelector.tsx'
import { Table } from './Table.tsx'
import { StatusBar } from './StatusBar.tsx'
import { computeTableData } from '../lib/table.ts'
import type { Symbol, Account, Holding, SymbolDimensionType, AccountDimensionType } from '../lib/types.ts'

const ROW_DIMS: { key: SymbolDimensionType; label: string }[] = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'countries', label: 'Country' },
  { key: 'assets', label: 'Asset Class' },
  { key: 'beta', label: 'Beta' },
]

const COL_DIMS: { key: AccountDimensionType; label: string }[] = [
  { key: 'account', label: 'Account' },
  { key: 'tax_status', label: 'Tax Status' },
  { key: 'provider', label: 'Provider' },
  { key: 'owner', label: 'Owner' },
]

interface AppProps {
  symbols: Symbol[]
  accounts: Account[]
  holdings: Holding[]
  onQuit?: () => void
  onContinue?: () => void
  onBack?: () => void
  onReset?: () => void
  extraStatusItems?: { key: string; label: string }[]
}

type Focus = 'rowDim' | 'colDim' | 'displayMode'

const DISPLAY_MODES = ['$k', '$', '%', 'Both'] as const
export type DisplayMode = typeof DISPLAY_MODES[number]

export function App({ symbols, accounts, holdings, onQuit, onContinue, onBack, onReset, extraStatusItems }: AppProps) {
  const { exit } = useApp()
  const [rowDimIndex, setRowDimIndex] = useState(0)
  const [colDimIndex, setColDimIndex] = useState(0)
  const [focus, setFocus] = useState<Focus>('rowDim')
  const [displayModeIndex, setDisplayModeIndex] = useState(0) // default "$"

  const rowDim = ROW_DIMS[rowDimIndex]!
  const colDim = COL_DIMS[colDimIndex]!

  const tableData = useMemo(
    () => computeTableData(symbols, accounts, holdings, rowDim.key, colDim.key),
    [symbols, accounts, holdings, rowDim.key, colDim.key]
  )

  const grandTotal = useMemo(
    () => tableData.rows.reduce((sum, r) => sum + r.total, 0),
    [tableData]
  )

  useInput((input, key) => {
    if (key.return && onContinue) {
      onContinue()
      return
    }

    if (input === 'b' && onBack) {
      onBack()
      return
    }

    if (input === 'z' && onReset) {
      onReset()
      return
    }

    if (input === 'q') {
      onQuit ? onQuit() : exit()
      return
    }

    if (key.tab || key.downArrow) {
      const order: Focus[] = ['rowDim', 'colDim', 'displayMode']
      setFocus(f => order[(order.indexOf(f) + 1) % order.length]!)
      return
    }

    if (key.upArrow) {
      const order: Focus[] = ['rowDim', 'colDim', 'displayMode']
      setFocus(f => order[(order.indexOf(f) - 1 + order.length) % order.length]!)
      return
    }

    if (key.leftArrow || key.rightArrow) {
      const delta = key.rightArrow ? 1 : -1
      if (focus === 'rowDim') {
        setRowDimIndex(i => (i + delta + ROW_DIMS.length) % ROW_DIMS.length)
      } else if (focus === 'colDim') {
        setColDimIndex(i => (i + delta + COL_DIMS.length) % COL_DIMS.length)
      } else {
        setDisplayModeIndex(i => (i + delta + DISPLAY_MODES.length) % DISPLAY_MODES.length)
      }
    }
  })

  const cursor = (f: Focus) => (
    <Text color="cyan">{focus === f ? ' ▸ ' : '   '}</Text>
  )

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Dimension selectors */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          {cursor('rowDim')}
          <DimSelector
            label="Row"
            labelWidth={4}
            options={ROW_DIMS.map(d => d.label)}
            selectedIndex={rowDimIndex}
            focused={focus === 'rowDim'}
          />
        </Box>
        <Box>
          {cursor('colDim')}
          <DimSelector
            label="Col"
            labelWidth={4}
            options={COL_DIMS.map(d => d.label)}
            selectedIndex={colDimIndex}
            focused={focus === 'colDim'}
          />
        </Box>
        <Box>
          {cursor('displayMode')}
          <DimSelector
            label="Cell"
            labelWidth={4}
            options={[...DISPLAY_MODES]}
            selectedIndex={displayModeIndex}
            focused={focus === 'displayMode'}
          />
        </Box>
      </Box>

      {/* Table */}
      <Box marginBottom={1}>
        <Table tableData={tableData} grandTotal={grandTotal} displayMode={DISPLAY_MODES[displayModeIndex]!} />
      </Box>

      {/* Status bar */}
      <StatusBar grandTotal={grandTotal} showContinue={!!onContinue} showBack={!!onBack} showReset={!!onReset} extraItems={extraStatusItems} />
    </Box>
  )
}
