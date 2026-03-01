import { tool, jsonSchema } from 'ai'
import type { StorageAdapter } from '../screens/storage.ts'
import {
  loadPortfolioDataAsync,
  loadPortfolioAsync,
  savePortfolioAsync,
} from '../screens/state.ts'
import {
  formatHoldingsMarkdown,
  formatTradesMarkdown,
  formatTableMarkdown,
} from '../lib/format.ts'
import { computeTableData } from '../lib/table.ts'
import {
  calculateRebalance,
  calculateRebalanceMinTrades,
} from '../lib/rebalance.ts'
import { convertToWholeShares } from '../lib/rebalance.ts'
import { generateTrades } from '../lib/trades.ts'
import { buildSymbols, buildAccounts, buildHoldings } from '../lib/input.ts'
import type { SymbolDimensionType, AccountDimensionType } from '../lib/types.ts'

interface CreateToolsOptions {
  storage: StorageAdapter
  onShowWizardStep?: (step: number) => void
}

export function createPortfolioTools({ storage, onShowWizardStep }: CreateToolsOptions) {
  return {
    get_portfolio: tool({
      description: 'Get the current portfolio holdings as a formatted markdown table',
      inputSchema: jsonSchema<Record<string, never>>({
        type: 'object',
        properties: {},
      }),
      execute: async () => {
        const data = await loadPortfolioDataAsync(storage)
        if (!data) return 'No portfolio loaded. Ask the user to import one first.'
        return formatHoldingsMarkdown(data.holdings)
      },
    }),

    get_portfolio_table: tool({
      description:
        'Get a portfolio breakdown by specific dimensions (e.g., by country and account)',
      inputSchema: jsonSchema<{ rowDimension: string; colDimension: string }>({
        type: 'object',
        properties: {
          rowDimension: {
            type: 'string',
            enum: ['symbol', 'countries', 'assets', 'beta'],
            description: 'What to group rows by',
          },
          colDimension: {
            type: 'string',
            enum: ['account', 'tax_status', 'provider', 'owner'],
            description: 'What to group columns by',
          },
        },
        required: ['rowDimension', 'colDimension'],
      }),
      execute: async ({ rowDimension, colDimension }) => {
        const data = await loadPortfolioDataAsync(storage)
        if (!data) return 'No portfolio loaded.'
        const tableData = computeTableData(
          data.symbols,
          data.accounts,
          data.holdings,
          rowDimension as SymbolDimensionType,
          colDimension as AccountDimensionType,
        )
        return formatTableMarkdown(
          tableData,
          rowDimension as SymbolDimensionType,
          colDimension as AccountDimensionType,
        )
      },
    }),

    get_targets: tool({
      description: 'Get the current target allocations for each symbol',
      inputSchema: jsonSchema<Record<string, never>>({
        type: 'object',
        properties: {},
      }),
      execute: async () => {
        const input = await loadPortfolioAsync(storage)
        if (!input) return 'No portfolio loaded.'
        if (!input.targets || Object.keys(input.targets).length === 0) {
          return 'No targets set yet. The user needs to set target allocations.'
        }
        const lines = ['| Symbol | Target % |', '|--------|--------:|']
        for (const [symbol, pct] of Object.entries(input.targets)) {
          lines.push(`| ${symbol} | ${pct}% |`)
        }
        return lines.join('\n')
      },
    }),

    set_targets: tool({
      description:
        'Set target allocation percentages for portfolio symbols. The percentages must sum to 100.',
      inputSchema: jsonSchema<{ targets: Record<string, number> }>({
        type: 'object',
        properties: {
          targets: {
            type: 'object',
            description: 'Map of symbol name to target percentage (must sum to 100)',
            additionalProperties: { type: 'number' },
          },
        },
        required: ['targets'],
      }),
      execute: async ({ targets }) => {
        const sum = Object.values(targets).reduce((a, b) => a + b, 0)
        if (Math.abs(sum - 100) > 0.1) {
          return `Target percentages sum to ${sum}%, but they must sum to 100%.`
        }

        const input = await loadPortfolioAsync(storage)
        if (!input) return 'No portfolio loaded.'

        input.targets = targets
        await savePortfolioAsync(storage, input)

        const lines = ['Targets updated:', '', '| Symbol | Target % |', '|--------|--------:|']
        for (const [symbol, pct] of Object.entries(targets)) {
          lines.push(`| ${symbol} | ${pct}% |`)
        }
        return lines.join('\n')
      },
    }),

    calculate_trades: tool({
      description: 'Calculate the rebalancing trades needed to reach target allocations',
      inputSchema: jsonSchema<{ strategy?: string }>({
        type: 'object',
        properties: {
          strategy: {
            type: 'string',
            enum: ['min_trades', 'consolidate'],
            description: 'Rebalancing strategy (default: min_trades)',
          },
        },
      }),
      execute: async ({ strategy: strategyArg }) => {
        const strategy = (strategyArg ?? 'min_trades') as 'min_trades' | 'consolidate'
        const input = await loadPortfolioAsync(storage)
        if (!input) return 'No portfolio loaded.'
        if (!input.targets || Object.keys(input.targets).length === 0) {
          return 'No targets set. Set target allocations first.'
        }

        const symbols = buildSymbols(input)
        const accounts = buildAccounts(input)
        const holdings = buildHoldings(input, symbols)

        let rebalanced
        if (strategy === 'min_trades') {
          rebalanced = calculateRebalanceMinTrades(symbols, accounts, holdings)
        } else {
          rebalanced = calculateRebalance(symbols, accounts, holdings)
        }

        const wholeShare = convertToWholeShares(rebalanced)
        const trades = generateTrades(wholeShare)

        return formatTradesMarkdown(trades, holdings, strategy)
      },
    }),

    show_wizard_step: tool({
      description:
        'Show a specific wizard step UI to the user. Use this to display the import, review, targets, or trades interface.',
      inputSchema: jsonSchema<{ step: number }>({
        type: 'object',
        properties: {
          step: {
            type: 'number',
            description: 'Step number (1=Import, 2=Review, 3=Targets, 4=Trades)',
          },
        },
        required: ['step'],
      }),
      execute: async ({ step }) => {
        if (onShowWizardStep) {
          onShowWizardStep(step)
          const stepNames: Record<number, string> = {
            1: 'Import',
            2: 'Review',
            3: 'Targets',
            4: 'Trades',
          }
          return `Showing Step ${step}: ${stepNames[step] ?? 'Unknown'}`
        }
        return 'Wizard step display not available in this mode.'
      },
    }),
  }
}
