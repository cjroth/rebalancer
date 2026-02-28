export interface Symbol {
  name: string
  price: number
  targetPercent?: number
  countries?: Record<string, number>
  assets?: Record<string, number>
  beta?: number
}

export interface Account {
  name: string
  tax_status?: string
  provider?: string
  owner?: string
}

export interface Holding {
  account: string
  symbol: string
  shares: number
  price: number
  amount: number
  targetShares?: number
  targetAmount?: number
}

export interface Trade {
  account: string
  symbol: string
  type: 'buy' | 'sell'
  shares: number
  amount: number
}

// Dimension types for grouping
export type SymbolDimensionType = 'symbol' | 'countries' | 'assets' | 'beta'
export type AccountDimensionType = 'account' | 'tax_status' | 'provider' | 'owner'

export interface TableCell {
  value: number
}

export interface RowGroup {
  key: string
  label: string
  total: number
  symbols?: string[]
}

export interface ColGroup {
  key: string
  label: string
  total: number
  accounts?: string[]
}

export interface TableData {
  rows: RowGroup[]
  cols: ColGroup[]
  cells: Map<string, TableCell>
  childCells?: Map<string, TableCell>
}

export interface RebalanceInput {
  holdings: { account: string; symbol: string; shares: number }[]
  targets?: Record<string, number>
  symbols?: { name: string; price?: number; countries?: Record<string, number>; assets?: Record<string, number>; beta?: number }[]
  accounts?: { name: string; tax_status?: string; provider?: string; owner?: string }[]
  rowDimension?: SymbolDimensionType
  colDimension?: AccountDimensionType
  strategy?: 'consolidate' | 'min_trades'
}
