import type { RebalanceInput, SymbolDimensionType, AccountDimensionType } from './types'

/**
 * Parses a multi-section CSV format:
 *
 * #holdings
 * account,symbol,shares
 * Fidelity 401k,VTI,100
 *
 * #symbols
 * name,price,countries,assets,beta
 * VTI,250.00,us:1.0,equity:1.0,1.0
 *
 * #accounts
 * name,tax_status,provider,owner
 * Fidelity 401k,tax_deferred,fidelity,sam
 *
 * #targets
 * symbol,percent
 * VTI,60
 *
 * #options
 * strategy,min_trades
 * rowDimension,symbol
 * colDimension,account
 */

function parseKeyValueMap(str: string): Record<string, number> {
  if (!str) return {}
  const result: Record<string, number> = {}
  for (const pair of str.split('|')) {
    const [key, val] = pair.split(':')
    if (key && val) result[key.trim()] = parseFloat(val.trim())
  }
  return result
}

export function parsePortfolioCsv(text: string): RebalanceInput {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '')

  const sections = new Map<string, string[]>()
  let currentSection = ''

  for (const line of lines) {
    if (line.startsWith('#')) {
      currentSection = line.slice(1).trim()
      sections.set(currentSection, [])
    } else if (currentSection) {
      sections.get(currentSection)!.push(line)
    }
  }

  // Parse holdings (required)
  const holdingsLines = sections.get('holdings') ?? []
  if (holdingsLines.length < 2) {
    throw new Error('Missing #holdings section with header + data rows')
  }
  // Skip header row
  const holdings = holdingsLines.slice(1).map(line => {
    const [account, symbol, shares] = line.split(',').map(s => s.trim())
    return { account: account!, symbol: symbol!, shares: parseFloat(shares!) }
  })

  // Parse symbols (optional)
  const symbolsLines = sections.get('symbols') ?? []
  let symbols: RebalanceInput['symbols']
  if (symbolsLines.length >= 2) {
    symbols = symbolsLines.slice(1).map(line => {
      const parts = line.split(',').map(s => s.trim())
      return {
        name: parts[0]!,
        price: parts[1] ? parseFloat(parts[1]) : undefined,
        countries: parseKeyValueMap(parts[2] ?? ''),
        assets: parseKeyValueMap(parts[3] ?? ''),
        beta: parts[4] ? parseFloat(parts[4]) : undefined,
      }
    })
  }

  // Parse accounts (optional)
  const accountsLines = sections.get('accounts') ?? []
  let accounts: RebalanceInput['accounts']
  if (accountsLines.length >= 2) {
    accounts = accountsLines.slice(1).map(line => {
      const parts = line.split(',').map(s => s.trim())
      return {
        name: parts[0]!,
        tax_status: parts[1] || undefined,
        provider: parts[2] || undefined,
        owner: parts[3] || undefined,
      }
    })
  }

  // Parse targets (optional)
  const targetsLines = sections.get('targets') ?? []
  let targets: Record<string, number> | undefined
  if (targetsLines.length >= 2) {
    targets = {}
    for (const line of targetsLines.slice(1)) {
      const [symbol, percent] = line.split(',').map(s => s.trim())
      targets[symbol!] = parseFloat(percent!)
    }
  }

  // Parse options (optional, key-value pairs without header)
  const optionsLines = sections.get('options') ?? []
  let strategy: RebalanceInput['strategy']
  let rowDimension: SymbolDimensionType | undefined
  let colDimension: AccountDimensionType | undefined
  for (const line of optionsLines) {
    const [key, value] = line.split(',').map(s => s.trim())
    if (key === 'strategy') strategy = value as RebalanceInput['strategy']
    if (key === 'rowDimension') rowDimension = value as SymbolDimensionType
    if (key === 'colDimension') colDimension = value as AccountDimensionType
  }

  return { holdings, symbols, accounts, targets, strategy, rowDimension, colDimension }
}

export function detectFormat(text: string): 'csv' | 'json' {
  const trimmed = text.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  return 'csv'
}
