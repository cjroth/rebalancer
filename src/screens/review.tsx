import { useEffect, useState } from 'react'
import { Box, Text, useApp } from 'ink'
import { App } from '../tui/App.tsx'
import { StepHeader } from '../components/step-header'
import { loadPortfolioDataAsync } from './state.ts'
import type { StorageAdapter } from './storage.ts'
import type { RebalanceInput, Symbol, Account, Holding } from '../lib/types.ts'

interface Step2Props {
  dataDir: string
  storage?: StorageAdapter
  onComplete: () => void
  onBack?: () => void
  onReset?: () => void
  portfolioInput?: RebalanceInput | null
  portfolioData?: { symbols: Symbol[]; accounts: Account[]; holdings: Holding[] } | null
  extraStatusItems?: { key: string; label: string }[]
}

export function Step2Review({ dataDir: _dataDir, storage, onComplete, onBack, onReset, portfolioData: preloaded, extraStatusItems }: Step2Props) {
  const { exit } = useApp()

  const adapter = storage!

  const [data, setData] = useState(preloaded ?? null)

  useEffect(() => {
    if (!data) {
      loadPortfolioDataAsync(adapter).then(setData)
    }
  }, [])

  if (!data) {
    return <Box paddingX={1}><Text dimColor>Loading...</Text></Box>
  }

  const { symbols, accounts, holdings } = data

  return (
    <Box flexDirection="column">
      <Box paddingX={1} marginBottom={0}>
        <StepHeader
          step={2}
          totalSteps={4}
          title="Review Current Positions"
          description=""
        />
      </Box>
      <App
        symbols={symbols}
        accounts={accounts}
        holdings={holdings}
        onContinue={onComplete}
        onBack={onBack}
        onQuit={() => exit()}
        onReset={onReset}
        extraStatusItems={extraStatusItems}
      />
    </Box>
  )
}
