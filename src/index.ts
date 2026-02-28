// Full wizard
export { Wizard } from './screens/wizard.tsx'
export type { WizardProps } from './screens/wizard.tsx'

// Individual screens
export { Step1Import as ImportScreen } from './screens/import.tsx'
export { Step2Review as ReviewScreen } from './screens/review.tsx'
export { Step3Targets as TargetsScreen } from './screens/targets.tsx'
export { Step4Trades as TradesScreen } from './screens/trades.tsx'

// Storage adapters
export { OpfsStorageAdapter, FsStorageAdapter } from './screens/storage.ts'
export type { StorageAdapter } from './screens/storage.ts'

// State helpers
export {
  getDataDir,
  ensureDataDir,
  readWizardState,
  writeWizardState,
  readWizardStateAsync,
  writeWizardStateAsync,
  loadPortfolio,
  loadPortfolioAsync,
  loadPortfolioData,
  loadPortfolioDataAsync,
  savePortfolio,
  savePortfolioAsync,
  portfolioExists,
  portfolioExistsAsync,
} from './screens/state.ts'

// Types
export type {
  RebalanceInput,
  Symbol,
  Account,
  Holding,
  Trade,
  SymbolDimensionType,
  AccountDimensionType,
  TableData,
  TableCell,
  RowGroup,
  ColGroup,
} from './lib/types.ts'

// Core logic
export { buildSymbols, buildAccounts, buildHoldings } from './lib/input.ts'
export { calculateRebalance, calculateRebalanceMinTrades, isTargetPercentValid, convertToWholeShares } from './lib/rebalance.ts'
export { generateTrades } from './lib/trades.ts'
export { computeTableData } from './lib/table.ts'
export { parsePortfolioCsv } from './lib/csv.ts'
export { formatTradesMarkdown, formatHoldingsMarkdown, formatTableMarkdown } from './lib/format.ts'
