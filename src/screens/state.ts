import { parsePortfolioCsv } from '../lib/csv'
import { toPortfolioCsv } from '../utils/to-portfolio-csv'
import { parseSchwabExport } from '../utils/parse-schwab'
import { buildSymbols, buildAccounts, buildHoldings } from '../lib/input'
import type { RebalanceInput, Symbol, Account, Holding, Trade } from '../lib/types'
import type { StorageAdapter } from './storage'

// --- Wizard state ---

export interface WizardState {
  currentStep: number
}

export async function readWizardStateAsync(storage: StorageAdapter): Promise<WizardState> {
  const text = await storage.read('wizard-state.json')
  if (text) {
    try { return JSON.parse(text) } catch {}
  }
  return { currentStep: 1 }
}

export async function writeWizardStateAsync(storage: StorageAdapter, state: WizardState): Promise<void> {
  await storage.write('wizard-state.json', JSON.stringify(state, null, 2) + '\n')
}

// --- Portfolio I/O (via StorageAdapter) ---

export async function loadPortfolioAsync(storage: StorageAdapter): Promise<RebalanceInput | null> {
  const text = await storage.read('portfolio.csv')
  if (!text) return null
  return parsePortfolioCsv(text)
}

export async function savePortfolioAsync(storage: StorageAdapter, input: RebalanceInput): Promise<void> {
  await storage.write('portfolio.csv', toPortfolioCsv(input))
}

export async function portfolioExistsAsync(storage: StorageAdapter): Promise<boolean> {
  return storage.exists('portfolio.csv')
}

export async function loadPortfolioDataAsync(storage: StorageAdapter): Promise<{ symbols: Symbol[]; accounts: Account[]; holdings: Holding[] } | null> {
  const input = await loadPortfolioAsync(storage)
  if (!input) return null
  const symbols = buildSymbols(input)
  return {
    symbols,
    accounts: buildAccounts(input),
    holdings: buildHoldings(input, symbols),
  }
}

// --- CSV detection ---

export function detectCsvSource(text: string): 'schwab' | 'universal' {
  const trimmed = text.trimStart()
  if (trimmed.startsWith('"Positions')) return 'schwab'
  return 'universal'
}

// --- Trade CSV ---

export function formatTradesCsv(trades: Trade[]): string {
  const lines = ['account,symbol,type,shares,amount']
  for (const t of trades) {
    lines.push(`${t.account},${t.symbol},${t.type},${parseFloat(t.shares.toFixed(2))},${t.amount.toFixed(2)}`)
  }
  lines.push('')
  return lines.join('\n')
}

// --- Percentage math (ported from src/lib/utils.ts, no tailwind dep) ---

export function roundPercent(percent: number): number {
  return Math.round(percent * 100) / 100
}

export function smartRoundPercentages(percentages: number[]): number[] {
  const rounded = percentages.map(p => roundPercent(p))
  const sum = rounded.reduce((acc, val) => acc + val, 0)
  const diff = roundPercent(100 - sum)

  if (Math.abs(diff) < 0.005) {
    return rounded
  }

  const fractionalParts = percentages.map((p, i) => ({
    index: i,
    fractional: Math.abs((p * 100) % 1 - (rounded[i]! * 100) % 1),
    value: rounded[i]!,
  }))

  fractionalParts.sort((a, b) => b.value - a.value)

  const result = [...rounded]
  let remaining = diff

  for (const item of fractionalParts) {
    if (Math.abs(remaining) < 0.005) break
    if (item.value > 0) {
      const adjustment = remaining > 0 ? 0.01 : -0.01
      if (result[item.index]! + adjustment >= 0) {
        result[item.index] = roundPercent(result[item.index]! + adjustment)
        remaining = roundPercent(remaining - adjustment)
      }
    }
  }

  return result
}

// Re-export for convenience
export { parsePortfolioCsv, toPortfolioCsv, parseSchwabExport, buildSymbols, buildAccounts, buildHoldings }
