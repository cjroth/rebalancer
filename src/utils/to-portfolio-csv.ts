import type { RebalanceInput } from '../lib/types'

export function serializeKeyValueMap(map: Record<string, number>): string {
  const entries = Object.entries(map)
  if (entries.length === 0) return ''
  return entries.map(([k, v]) => `${k}:${v}`).join('|')
}

export function toPortfolioCsv(input: RebalanceInput): string {
  const lines: string[] = []

  // #holdings (required)
  lines.push('#holdings')
  lines.push('account,symbol,shares')
  for (const h of input.holdings) {
    lines.push(`${h.account},${h.symbol},${h.shares}`)
  }

  // #symbols (optional)
  if (input.symbols?.length) {
    lines.push('')
    lines.push('#symbols')
    lines.push('name,price,countries,assets,beta')
    for (const s of input.symbols) {
      const price = s.price !== undefined ? String(s.price) : ''
      const countries = serializeKeyValueMap(s.countries ?? {})
      const assets = serializeKeyValueMap(s.assets ?? {})
      const beta = s.beta !== undefined ? String(s.beta) : ''
      lines.push(`${s.name},${price},${countries},${assets},${beta}`)
    }
  }

  // #accounts (optional)
  if (input.accounts?.length) {
    lines.push('')
    lines.push('#accounts')
    lines.push('name,tax_status,provider,owner')
    for (const a of input.accounts) {
      lines.push(`${a.name},${a.tax_status ?? ''},${a.provider ?? ''},${a.owner ?? ''}`)
    }
  }

  // #targets (optional)
  if (input.targets && Object.keys(input.targets).length > 0) {
    lines.push('')
    lines.push('#targets')
    lines.push('symbol,percent')
    for (const [symbol, percent] of Object.entries(input.targets)) {
      lines.push(`${symbol},${percent}`)
    }
  }

  // #options (optional)
  const hasOptions = input.strategy || input.rowDimension || input.colDimension
  if (hasOptions) {
    lines.push('')
    lines.push('#options')
    if (input.strategy) lines.push(`strategy,${input.strategy}`)
    if (input.rowDimension) lines.push(`rowDimension,${input.rowDimension}`)
    if (input.colDimension) lines.push(`colDimension,${input.colDimension}`)
  }

  lines.push('')
  return lines.join('\n')
}
