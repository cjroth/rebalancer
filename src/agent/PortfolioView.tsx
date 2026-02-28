import { Box, Text, useInput } from 'ink'
import { App } from '../tui/App.tsx'
import { returnFromPortfolio } from './bridge.ts'
import type { Symbol, Account, Holding } from '../lib/types.ts'

interface PortfolioViewProps {
  symbols: Symbol[]
  accounts: Account[]
  holdings: Holding[]
}

export function PortfolioView({ symbols, accounts, holdings }: PortfolioViewProps) {
  useInput((_input, key) => {
    if (key.escape) {
      returnFromPortfolio()
    }
  })

  return (
    <Box flexDirection="column">
      <Box paddingX={1} marginBottom={1}>
        <Text bold inverse color="cyan">{" PORTFOLIO VIEW "}</Text>
        <Text dimColor>{" Press Esc to return to chat"}</Text>
      </Box>
      <App symbols={symbols} accounts={accounts} holdings={holdings} onQuit={() => {}} />
    </Box>
  )
}
