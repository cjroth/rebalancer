import { useState, useCallback, useEffect } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { SelectInput } from '../components/select-input'
import type { SelectInputItem } from '../components/select-input'
import { AsciiTitle } from '../components/ascii-title'
import { StepHeader } from '../components/step-header'
import { StatusBar } from '../components/status-bar.tsx'
import type { StatusBarItem } from '../components/status-bar.tsx'
import {
  detectCsvSource,
  savePortfolioAsync,
  loadPortfolioAsync,
  portfolioExistsAsync,
  parsePortfolioCsv,
  parseSchwabExport,
  buildSymbols,
  buildAccounts,
  buildHoldings,
} from './state.ts'
import type { StorageAdapter } from './storage.ts'
import type { RebalanceInput, Symbol, Account, Holding } from '../lib/types'
import { demoScenarios } from '../lib/demo-portfolios.ts'

interface Step1Props {
  dataDir: string
  storage?: StorageAdapter
  onComplete: () => void
  onBack?: () => void
  onReset?: () => void
  portfolioInput?: RebalanceInput | null
  portfolioData?: { symbols: Symbol[]; accounts: Account[]; holdings: Holding[] } | null
  onPortfolioImported?: (input: RebalanceInput, data: { symbols: Symbol[]; accounts: Account[]; holdings: Holding[] }) => void
  /** Browser mode: CSV text from a file drop (set by parent) */
  droppedCsv?: string | null
  /** Browser mode: callback to clear droppedCsv after consumption */
  onDropConsumed?: () => void
  /** Terminal mode: callback to read a file by path (avoids bundling fs in browser) */
  readFile?: (path: string) => string
  extraStatusItems?: StatusBarItem[]
}

function processImport(
  text: string,
  existing: RebalanceInput | undefined
): { result: RebalanceInput; source: string } {
  const source = detectCsvSource(text)
  let result: RebalanceInput
  if (source === 'schwab') {
    result = parseSchwabExport(text, existing)
  } else {
    result = parsePortfolioCsv(text)
  }
  return { result, source: source === 'schwab' ? 'Schwab' : 'universal' }
}

function buildSummary(result: RebalanceInput, source: string): string {
  const symbolCount = new Set(result.holdings.map(h => h.symbol)).size
  const accountCount = new Set(result.holdings.map(h => h.account)).size
  const priceMap = new Map<string, number>()
  if (result.symbols) {
    for (const s of result.symbols) priceMap.set(s.name, s.price ?? 1)
  }
  const total = result.holdings.reduce((sum, h) => sum + h.shares * (priceMap.get(h.symbol) ?? 1), 0)
  const fmt = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `Imported ${source} CSV: ${result.holdings.length} holdings, ${symbolCount} symbols, ${accountCount} accounts, ${fmt} total`
}

const demoItems: SelectInputItem<number>[] = demoScenarios.map((demo, i) => ({
  key: demo.id,
  label: demo.label,
  value: i,
}))

export function Step1Import({ dataDir, storage, onComplete, onBack: _onBack, onReset, portfolioInput: existingPortfolio, onPortfolioImported, droppedCsv, onDropConsumed, readFile, extraStatusItems }: Step1Props) {
  const { exit } = useApp()
  const [inputBuffer, setInputBuffer] = useState('')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [imported, setImported] = useState(false)

  const isBrowser = !!storage

  const adapter = storage!

  const handleCsvText = useCallback(async (text: string, sourceLabel?: string) => {
    try {
      let existing: RebalanceInput | undefined
      if (existingPortfolio) {
        existing = existingPortfolio
      } else if (await portfolioExistsAsync(adapter)) {
        existing = (await loadPortfolioAsync(adapter)) ?? undefined
      }

      const { result, source } = processImport(text, existing)

      await savePortfolioAsync(adapter, result)

      const symbols = buildSymbols(result)
      const data = {
        symbols,
        accounts: buildAccounts(result),
        holdings: buildHoldings(result, symbols),
      }
      onPortfolioImported?.(result, data)

      setSummary(buildSummary(result, sourceLabel ?? source))
      setImported(true)
      setError('')
    } catch (e: any) {
      setError(e.message || String(e))
    }
  }, [adapter, existingPortfolio, onPortfolioImported])

  // Browser mode: handle file drops from any phase
  useEffect(() => {
    if (droppedCsv) {
      handleCsvText(droppedCsv)
      onDropConsumed?.()
    }
  }, [droppedCsv])

  useInput((input, key) => {
    if (key.escape) {
      exit()
      return
    }

    if (imported) {
      if (input === 'b') {
        setImported(false)
        setSummary('')
        return
      }
      if (input === 'z' && onReset) {
        onReset()
        return
      }
      if (key.return) {
        onComplete()
      }
      return
    }

    // === Text entry for file path / CSV paste ===

    if (key.return) {
      const raw = inputBuffer.trim()
      if (raw) {
        if (isBrowser || !readFile) {
          handleCsvText(raw)
        } else {
          const filePath = raw.replace(/^['"]|['"]$/g, '')
          try {
            const text = readFile(filePath)
            handleCsvText(text)
          } catch (e: any) {
            setError(e.message || String(e))
          }
        }
      }
      return
    }

    if (key.backspace || key.delete) {
      setInputBuffer(prev => prev.slice(0, -1))
      return
    }

    if (input && !key.ctrl && !key.meta) {
      setInputBuffer(prev => prev + input)
    }
  })

  const handleDemoSelect = useCallback((item: SelectInputItem<number>) => {
    const demo = demoScenarios[item.value]!
    handleCsvText(demo.csv, `demo (${demo.label})`)
  }, [handleCsvText])

  const statusItems: StatusBarItem[] = []
  if (imported) statusItems.push({ key: 'b', label: 'back' })
  if (onReset) statusItems.push({ key: 'z', label: 'reset' })
  if (extraStatusItems) statusItems.push(...extraStatusItems)
  if (imported) statusItems.push({ key: '⏎', label: 'continue' })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1} flexDirection="column">
        <AsciiTitle />
      </Box>

      <Box marginBottom={1}>
        <StepHeader
          step={1}
          totalSteps={4}
          title="Import Portfolio"
          description=""
        />
      </Box>

      <Box>
        <Text bold color="green">{"> "}</Text>
        {inputBuffer
          ? <Text>{inputBuffer}<Text inverse>{" "}</Text></Text>
          : <Text dimColor>{isBrowser
              ? 'Drag and drop a CSV file, or paste CSV data and press Enter'
              : 'Paste or drag a CSV file path, then press Enter'}</Text>}
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {summary && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green">{summary}</Text>
          {!isBrowser && <Text dimColor>Saved to {dataDir}/portfolio.csv</Text>}
          {isBrowser && <Text dimColor>Saved to browser storage</Text>}
        </Box>
      )}

      {!imported && (
        <Box marginTop={1} flexDirection="column">
          <Text>Or pick a demo portfolio:</Text>
          <Box marginTop={1}>
            <SelectInput
              items={demoItems}
              focus={!inputBuffer}
              onSelect={handleDemoSelect}
            />
          </Box>
        </Box>
      )}

      {statusItems.length > 0 && (
        <Box marginTop={1}>
          <StatusBar items={statusItems} />
        </Box>
      )}
    </Box>
  )
}
