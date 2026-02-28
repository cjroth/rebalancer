import type { RebalanceInput } from '../lib/types'

export interface SchwabPosition {
  account: string
  symbol: string
  description: string
  quantity: number | null
  price: number
  marketValue: number
  securityType: string
}

export function parseQuotedCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

export function parseDollarAmount(str: string): number {
  if (!str || str === '--') return 0
  const negative = str.includes('-') && !str.startsWith('$')
  const cleaned = str.replace(/[$,\-]/g, '')
  const val = parseFloat(cleaned)
  if (isNaN(val)) return 0
  return negative || str.startsWith('-') ? -val : val
}

export function parseQuantity(str: string): number | null {
  if (!str || str === '--') return null
  const cleaned = str.replace(/,/g, '')
  const val = parseFloat(cleaned)
  return isNaN(val) ? null : val
}

export function cleanAccountName(raw: string): string {
  return raw.replace(/\s+\.\.\.\d+$/, '').trim()
}

export function inferAccountMetadata(accountName: string): { tax_status?: string; provider: string; owner?: string } {
  const lower = accountName.toLowerCase()
  const provider = 'schwab'

  // Owner: text before the first underscore, lowercased
  const underscoreIdx = accountName.indexOf('_')
  const owner = underscoreIdx > 0 ? accountName.slice(0, underscoreIdx).toLowerCase() : undefined

  let tax_status: string | undefined
  if (lower.includes('roth')) tax_status = 'roth'
  else if (lower.includes('trad') || lower.includes('401k')) tax_status = 'traditional'
  else if (lower.includes('cash') || lower.includes('individual') || lower.includes('brokerage')) tax_status = 'taxable'

  return { tax_status, provider, owner }
}

export function parseSchwabCsv(text: string): SchwabPosition[] {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/)
  const positions: SchwabPosition[] = []

  let currentAccount = ''
  let colMap: Record<string, number> = {}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line) continue

    // Skip the title/timestamp line (line 1)
    if (i === 0 && line.startsWith('"Positions')) continue

    // Account header: "Name ...NNN" (unquoted, no commas in the account name part)
    if (!line.startsWith('"') && /\.\.\.\d+/.test(line)) {
      currentAccount = cleanAccountName(line)
      colMap = {}
      continue
    }

    // Column header row: starts with "Symbol"
    if (line.startsWith('"Symbol"')) {
      const headers = parseQuotedCsvLine(line)
      colMap = {}
      for (let j = 0; j < headers.length; j++) {
        const h = headers[j]!.toLowerCase()
        if (h === 'symbol') colMap['symbol'] = j
        if (h === 'description') colMap['description'] = j
        if (h.startsWith('qty')) colMap['quantity'] = j
        if (h === 'price') colMap['price'] = j
        if (h.startsWith('mkt val') || h === 'market value') colMap['marketValue'] = j
        if (h.startsWith('security type')) colMap['securityType'] = j
      }
      continue
    }

    // Skip if no account context yet or no column map
    if (!currentAccount || colMap['symbol'] === undefined) continue

    const fields = parseQuotedCsvLine(line)
    const symbol = fields[colMap['symbol']!] ?? ''

    // Skip Account Total rows
    if (symbol === 'Account Total') continue

    // Skip empty symbols
    if (!symbol) continue

    const description = fields[colMap['description'] ?? -1] ?? ''
    const mktValStr = fields[colMap['marketValue'] ?? -1] ?? '0'
    const qtyStr = fields[colMap['quantity'] ?? -1] ?? '--'
    const priceStr = fields[colMap['price'] ?? -1] ?? '--'
    const secType = fields[colMap['securityType'] ?? -1] ?? ''

    const marketValue = parseDollarAmount(mktValStr)
    const isCash = symbol === 'Cash & Cash Investments'
    const mappedSymbol = isCash ? 'CASH' : symbol

    positions.push({
      account: currentAccount,
      symbol: mappedSymbol,
      description: isCash ? 'Cash' : description,
      quantity: parseQuantity(qtyStr),
      price: isCash ? 1.0 : parseDollarAmount(priceStr),
      marketValue,
      securityType: secType,
    })
  }

  return positions
}

export function schwabToRebalanceInput(positions: SchwabPosition[], existing?: RebalanceInput): RebalanceInput {
  const holdings = positions.map(p => {
    // CASH: shares = marketValue, price = 1.0
    const isCash = p.symbol === 'CASH'
    const shares = isCash ? p.marketValue : (p.quantity ?? 0)
    return {
      account: p.account,
      symbol: p.symbol,
      shares,
    }
  })

  // Build accounts from unique account names
  const accountNames = [...new Set(positions.map(p => p.account))]
  const existingAccountMap = new Map<string, NonNullable<RebalanceInput['accounts']>[number]>()
  if (existing?.accounts) {
    for (const a of existing.accounts) existingAccountMap.set(a.name, a)
  }

  const accounts = accountNames.map(name => {
    const ex = existingAccountMap.get(name)
    if (ex) return ex
    const inferred = inferAccountMetadata(name)
    return { name, ...inferred }
  })

  // Build symbols: preserve existing metadata, add new symbols with no metadata
  const symbolNames = [...new Set(positions.map(p => p.symbol))]
  const existingSymbolMap = new Map<string, NonNullable<RebalanceInput['symbols']>[number]>()
  if (existing?.symbols) {
    for (const s of existing.symbols) existingSymbolMap.set(s.name, s)
  }

  // Build price map from positions (use latest price per symbol)
  const priceMap = new Map<string, number>()
  for (const p of positions) {
    if (p.price > 0) priceMap.set(p.symbol, p.price)
  }

  const symbols = symbolNames.map(name => {
    const ex = existingSymbolMap.get(name)
    const price = priceMap.get(name)
    if (ex) return { ...ex, price: price ?? ex.price }
    return price !== undefined ? { name, price } : { name }
  })

  const result: RebalanceInput = { holdings, symbols, accounts }

  // Preserve targets from existing
  if (existing?.targets) result.targets = existing.targets

  // Preserve options from existing
  if (existing?.strategy) result.strategy = existing.strategy
  if (existing?.rowDimension) result.rowDimension = existing.rowDimension
  if (existing?.colDimension) result.colDimension = existing.colDimension

  return result
}

export function parseSchwabExport(text: string, existing?: RebalanceInput): RebalanceInput {
  const positions = parseSchwabCsv(text)
  return schwabToRebalanceInput(positions, existing)
}
