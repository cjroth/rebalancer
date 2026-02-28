import { Box, Text } from 'ink'
import { StatusBar as StatusBarBase } from '../components/status-bar'
import type { StatusBarItem } from '../components/status-bar'

interface PortfolioStatusBarProps {
  grandTotal: number
  showContinue?: boolean
  showBack?: boolean
  showReset?: boolean
}

function formatUSD(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function StatusBar({ grandTotal, showContinue, showBack, showReset }: PortfolioStatusBarProps) {
  const items: StatusBarItem[] = [
    { key: 'Tab', label: 'switch' },
    { key: '←→', label: 'navigate' },
    { key: 'q', label: 'quit' },
  ]
  if (showBack) items.push({ key: 'b', label: 'back' })
  if (showContinue) items.push({ key: '⏎', label: 'continue' })
  if (showReset) items.push({ key: 'z', label: 'reset' })

  return (
    <StatusBarBase
      items={items}
      extra={
        <Box gap={1}>
          <Text dimColor>Total:</Text>
          <Text bold color="yellowBright">{formatUSD(grandTotal)}</Text>
        </Box>
      }
    />
  )
}
