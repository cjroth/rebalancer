import { describe, it, expect } from 'bun:test'
import { toPortfolioCsv, serializeKeyValueMap } from './to-portfolio-csv'
import { parsePortfolioCsv } from '../lib/csv'
import type { RebalanceInput } from '../lib/types'

describe('serializeKeyValueMap', () => {
  it('serializes single entry', () => {
    expect(serializeKeyValueMap({ us: 1.0 })).toBe('us:1')
  })

  it('serializes multiple entries with pipe separator', () => {
    expect(serializeKeyValueMap({ us: 0.5, international: 0.5 })).toBe('us:0.5|international:0.5')
  })

  it('returns empty string for empty map', () => {
    expect(serializeKeyValueMap({})).toBe('')
  })
})

describe('toPortfolioCsv', () => {
  it('serializes holdings only', () => {
    const input: RebalanceInput = {
      holdings: [
        { account: 'Acct1', symbol: 'VTI', shares: 200 },
        { account: 'Acct1', symbol: 'VXUS', shares: 300 },
      ],
    }
    const csv = toPortfolioCsv(input)
    expect(csv).toContain('#holdings')
    expect(csv).toContain('account,symbol,shares')
    expect(csv).toContain('Acct1,VTI,200')
    expect(csv).toContain('Acct1,VXUS,300')
    expect(csv).not.toContain('#symbols')
    expect(csv).not.toContain('#accounts')
  })

  it('serializes with symbols section including price', () => {
    const input: RebalanceInput = {
      holdings: [{ account: 'A', symbol: 'VTI', shares: 10 }],
      symbols: [
        { name: 'VTI', price: 250, countries: { us: 1.0 }, assets: { equity: 1.0 }, beta: 1.0 },
      ],
    }
    const csv = toPortfolioCsv(input)
    expect(csv).toContain('#symbols')
    expect(csv).toContain('name,price,countries,assets,beta')
    expect(csv).toContain('VTI,250,us:1,equity:1,1')
  })

  it('serializes with accounts section', () => {
    const input: RebalanceInput = {
      holdings: [{ account: 'My_401k', symbol: 'BND', shares: 20 }],
      accounts: [
        { name: 'My_401k', tax_status: 'traditional', provider: 'fidelity', owner: 'me' },
      ],
    }
    const csv = toPortfolioCsv(input)
    expect(csv).toContain('#accounts')
    expect(csv).toContain('My_401k,traditional,fidelity,me')
  })

  it('serializes with targets section', () => {
    const input: RebalanceInput = {
      holdings: [{ account: 'A', symbol: 'VTI', shares: 10 }],
      targets: { VTI: 60, BND: 40 },
    }
    const csv = toPortfolioCsv(input)
    expect(csv).toContain('#targets')
    expect(csv).toContain('symbol,percent')
    expect(csv).toContain('VTI,60')
    expect(csv).toContain('BND,40')
  })

  it('serializes with options section', () => {
    const input: RebalanceInput = {
      holdings: [{ account: 'A', symbol: 'X', shares: 1 }],
      strategy: 'min_trades',
      rowDimension: 'assets',
      colDimension: 'owner',
    }
    const csv = toPortfolioCsv(input)
    expect(csv).toContain('#options')
    expect(csv).toContain('strategy,min_trades')
    expect(csv).toContain('rowDimension,assets')
    expect(csv).toContain('colDimension,owner')
  })

  it('roundtrips holdings-only input', () => {
    const input: RebalanceInput = {
      holdings: [
        { account: 'Brokerage', symbol: 'SPY', shares: 84 },
        { account: 'Brokerage', symbol: 'AGG', shares: 180 },
        { account: 'IRA', symbol: 'SPY', shares: 50 },
      ],
    }
    const csv = toPortfolioCsv(input)
    const parsed = parsePortfolioCsv(csv)
    expect(parsed.holdings).toEqual(input.holdings)
  })

  it('roundtrips full input with all sections', () => {
    const input: RebalanceInput = {
      holdings: [
        { account: 'Taxable', symbol: 'VTI', shares: 320 },
        { account: 'Taxable', symbol: 'VXUS', shares: 640 },
        { account: 'Roth', symbol: 'BND', shares: 400 },
        { account: 'Roth', symbol: 'CASH', shares: 5000 },
      ],
      symbols: [
        { name: 'VTI', price: 250, countries: { us: 1 }, assets: { equity: 1 }, beta: 1.0 },
        { name: 'VXUS', price: 62.5, countries: { international: 1 }, assets: { equity: 1 }, beta: 1.1 },
        { name: 'BND', price: 75, countries: { us: 0.7, international: 0.3 }, assets: { bonds: 1 }, beta: 0.3 },
        { name: 'CASH', price: 1, countries: { us: 1 }, assets: { cash: 1 }, beta: 0 },
      ],
      accounts: [
        { name: 'Taxable', tax_status: 'taxable', provider: 'schwab', owner: 'alice' },
        { name: 'Roth', tax_status: 'roth', provider: 'schwab', owner: 'alice' },
      ],
      targets: { VTI: 50, VXUS: 25, BND: 20, CASH: 5 },
      strategy: 'consolidate',
      rowDimension: 'assets',
      colDimension: 'tax_status',
    }
    const csv = toPortfolioCsv(input)
    const parsed = parsePortfolioCsv(csv)

    expect(parsed.holdings).toEqual(input.holdings)
    expect(parsed.symbols).toEqual(input.symbols)
    expect(parsed.accounts).toEqual(input.accounts)
    expect(parsed.targets).toEqual(input.targets)
    expect(parsed.strategy).toBe(input.strategy)
    expect(parsed.rowDimension).toBe(input.rowDimension)
    expect(parsed.colDimension).toBe(input.colDimension)
  })

  it('handles symbols with empty optional fields', () => {
    const input: RebalanceInput = {
      holdings: [{ account: 'A', symbol: 'XYZ', shares: 10 }],
      symbols: [{ name: 'XYZ' }],
    }
    const csv = toPortfolioCsv(input)
    const parsed = parsePortfolioCsv(csv)
    expect(parsed.symbols![0]!.name).toBe('XYZ')
    expect(parsed.symbols![0]!.countries).toEqual({})
    expect(parsed.symbols![0]!.assets).toEqual({})
  })

  it('handles accounts with missing optional fields', () => {
    const input: RebalanceInput = {
      holdings: [{ account: 'Solo', symbol: 'A', shares: 1 }],
      accounts: [{ name: 'Solo' }],
    }
    const csv = toPortfolioCsv(input)
    const parsed = parsePortfolioCsv(csv)
    expect(parsed.accounts![0]!.name).toBe('Solo')
    expect(parsed.accounts![0]!.tax_status).toBeUndefined()
  })
})
