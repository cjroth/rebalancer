import { Box, useApp } from 'ink'
import { App } from '../tui/App.tsx'
import { StepHeader } from '../components/step-header'
import { loadPortfolioData } from './state.ts'
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
}

export function Step2Review({ dataDir, storage: _storage, onComplete, onBack, onReset, portfolioData: preloaded }: Step2Props) {
  const { exit } = useApp()

  // Use pre-loaded data (browser) or load from fs (terminal)
  const { symbols, accounts, holdings } = preloaded ?? loadPortfolioData(dataDir)

  return (
    <Box flexDirection="column">
      <Box paddingX={1} marginBottom={0}>
        <StepHeader
          step={2}
          totalSteps={4}
          title="Review Portfolio"
          description="Explore your portfolio across different dimensions. Use Tab and arrows to switch between rows, columns, and display modes."
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
      />
    </Box>
  )
}
