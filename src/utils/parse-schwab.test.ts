import { describe, it, expect } from 'bun:test'
import {
  parseQuotedCsvLine,
  parseDollarAmount,
  parseQuantity,
  cleanAccountName,
  inferAccountMetadata,
  parseSchwabCsv,
  schwabToRebalanceInput,
  parseSchwabExport,
} from './parse-schwab'
import { toPortfolioCsv } from './to-portfolio-csv'
import { parsePortfolioCsv } from '../lib/csv'

describe('parseQuotedCsvLine', () => {
  it('parses simple quoted fields', () => {
    expect(parseQuotedCsvLine('"A","B","C"')).toEqual(['A', 'B', 'C'])
  })

  it('handles embedded commas in quotes', () => {
    expect(parseQuotedCsvLine('"Hello, World","B"')).toEqual(['Hello, World', 'B'])
  })

  it('handles escaped quotes', () => {
    expect(parseQuotedCsvLine('"He said ""hi""","B"')).toEqual(['He said "hi"', 'B'])
  })

  it('handles mixed quoted and unquoted', () => {
    expect(parseQuotedCsvLine('A,"B",C')).toEqual(['A', 'B', 'C'])
  })

  it('handles trailing comma', () => {
    expect(parseQuotedCsvLine('"A","B",')).toEqual(['A', 'B', ''])
  })
})

describe('parseDollarAmount', () => {
  it('parses standard dollar amount', () => {
    expect(parseDollarAmount('$10,389.47')).toBe(10389.47)
  })

  it('parses negative dollar amount', () => {
    expect(parseDollarAmount('-$9.31')).toBe(-9.31)
  })

  it('returns 0 for dashes', () => {
    expect(parseDollarAmount('--')).toBe(0)
  })

  it('returns 0 for empty string', () => {
    expect(parseDollarAmount('')).toBe(0)
  })

  it('parses amount without dollar sign', () => {
    expect(parseDollarAmount('1,234.56')).toBe(1234.56)
  })

  it('parses simple number', () => {
    expect(parseDollarAmount('$0.09')).toBe(0.09)
  })
})

describe('parseQuantity', () => {
  it('parses integer quantity', () => {
    expect(parseQuantity('91')).toBe(91)
  })

  it('parses quantity with commas', () => {
    expect(parseQuantity('1,299')).toBe(1299)
  })

  it('parses fractional quantity', () => {
    expect(parseQuantity('101.6968')).toBe(101.6968)
  })

  it('parses quantity with commas and decimals', () => {
    expect(parseQuantity('10,149.64')).toBe(10149.64)
  })

  it('returns null for dashes', () => {
    expect(parseQuantity('--')).toBeNull()
  })

  it('returns null for empty', () => {
    expect(parseQuantity('')).toBeNull()
  })
})

describe('cleanAccountName', () => {
  it('strips trailing account number', () => {
    expect(cleanAccountName('Sam_Cash ...918')).toBe('Sam_Cash')
  })

  it('handles multiple spaces', () => {
    expect(cleanAccountName('Alex_Roth_IRA  ...460')).toBe('Alex_Roth_IRA')
  })

  it('leaves clean name unchanged', () => {
    expect(cleanAccountName('MyAccount')).toBe('MyAccount')
  })
})

describe('inferAccountMetadata', () => {
  it('infers taxable for Cash account', () => {
    const meta = inferAccountMetadata('Sam_Cash')
    expect(meta.tax_status).toBe('taxable')
    expect(meta.provider).toBe('schwab')
    expect(meta.owner).toBe('sam')
  })

  it('infers roth for Roth IRA', () => {
    const meta = inferAccountMetadata('Alex_Roth_IRA')
    expect(meta.tax_status).toBe('roth')
    expect(meta.owner).toBe('alex')
  })

  it('infers traditional for 401k', () => {
    const meta = inferAccountMetadata('Sam_Trad_401k')
    expect(meta.tax_status).toBe('traditional')
    expect(meta.owner).toBe('sam')
  })

  it('infers traditional for Trad IRA', () => {
    const meta = inferAccountMetadata('Sam_Trad_IRA')
    expect(meta.tax_status).toBe('traditional')
  })

  it('returns undefined owner when no underscore', () => {
    const meta = inferAccountMetadata('Brokerage')
    expect(meta.owner).toBeUndefined()
  })
})

describe('parseSchwabCsv', () => {
  const singleAccount = `"Positions for All-Accounts as of 08:50 PM ET, 02/24/2026"

Test_Cash ...123
"Symbol","Description","Qty (Quantity)","Price","Price Chng $ (Price Change $)","Price Chng % (Price Change %)","Mkt Val (Market Value)","Day Chng $ (Day Change $)","Day Chng % (Day Change %)","Cost Basis","Gain $ (Gain/Loss $)","Gain % (Gain/Loss %)","Ratings","Reinvest?","Reinvest Capital Gains?","% of Acct (% of Account)","Security Type",
"VTI","VANGUARD TOTAL STOCK MARKET ETF","100","250.00","1.50","0.6%","$25,000.00","$150.00","0.6%","$20,000.00","$5,000.00","25%","--","No","N/A","80%","ETFs & Closed End Funds",
"Cash & Cash Investments","--","--","--","--","--","$6,250.00","$0.00","0%","--","--","--","--","--","--","20%","Cash and Money Market",
"Account Total","","--","--","--","--","$31,250.00","$150.00","0.48%","$20,000.00","$5,000.00","25%","--","--","--","--","--",
`

  it('parses single account with holdings and cash', () => {
    const positions = parseSchwabCsv(singleAccount)
    expect(positions).toHaveLength(2)
    expect(positions[0]).toEqual({
      account: 'Test_Cash',
      symbol: 'VTI',
      description: 'VANGUARD TOTAL STOCK MARKET ETF',
      quantity: 100,
      price: 250,
      marketValue: 25000,
      securityType: 'ETFs & Closed End Funds',
    })
    expect(positions[1]).toEqual({
      account: 'Test_Cash',
      symbol: 'CASH',
      description: 'Cash',
      quantity: null,
      price: 1.0,
      marketValue: 6250,
      securityType: 'Cash and Money Market',
    })
  })

  it('skips Account Total rows', () => {
    const positions = parseSchwabCsv(singleAccount)
    expect(positions.every(p => p.symbol !== 'Account Total')).toBe(true)
  })

  const multiAccount = `"Positions for All-Accounts as of 05:00 PM ET, 01/15/2026"

Alice_Roth ...555
"Symbol","Description","Qty (Quantity)","Price","Price Chng $ (Price Change $)","Price Chng % (Price Change %)","Mkt Val (Market Value)","Day Chng $ (Day Change $)","Day Chng % (Day Change %)","Cost Basis","Gain $ (Gain/Loss $)","Gain % (Gain/Loss %)","Ratings","Reinvest?","Reinvest Capital Gains?","% of Acct (% of Account)","Security Type",
"VXUS","VANGUARD INTL STK","50","83.00","0.20","0.24%","$4,150.00","$10.00","0.24%","$3,800.00","$350.00","9.21%","--","No","N/A","95%","ETFs & Closed End Funds",
"Cash & Cash Investments","--","--","--","--","--","$200.00","$0.00","0%","--","--","--","--","--","--","5%","Cash and Money Market",
"Account Total","","--","--","--","--","$4,350.00","$10.00","0.23%","$3,800.00","$350.00","9.21%","--","--","--","--","--",


Bob_Trad_401k ...777
"Symbol","Description","Qty (Quantity)","Price","Price Chng $ (Price Change $)","Price Chng % (Price Change %)","Mkt Val (Market Value)","Day Chng $ (Day Change $)","Day Chng % (Day Change %)","Cost Basis","Gain $ (Gain/Loss $)","Gain % (Gain/Loss %)","Ratings","Reinvest?","Reinvest Capital Gains?","% of Acct (% of Account)","Security Type",
"BND","VANGUARD TOTAL BOND","200","72.50","-0.10","-0.14%","$14,500.00","-$20.00","-0.14%","$14,000.00","$500.00","3.57%","--","No","N/A","100%","ETFs & Closed End Funds",
"Cash & Cash Investments","--","--","--","--","--","$0.00","$0.00","0%","--","--","--","--","--","--","0%","Cash and Money Market",
"Account Total","","--","--","--","--","$14,500.00","-$20.00","-0.14%","$14,000.00","$500.00","3.57%","--","--","--","--","--",
`

  it('parses multiple accounts', () => {
    const positions = parseSchwabCsv(multiAccount)
    const alice = positions.filter(p => p.account === 'Alice_Roth')
    const bob = positions.filter(p => p.account === 'Bob_Trad_401k')
    expect(alice).toHaveLength(2)
    expect(bob).toHaveLength(2)
    expect(alice[0]!.symbol).toBe('VXUS')
    expect(alice[0]!.price).toBe(83)
    expect(bob[0]!.symbol).toBe('BND')
    expect(bob[0]!.price).toBe(72.5)
  })

  it('handles empty account (cash only)', () => {
    const csv = `"Positions for All-Accounts as of 08:50 PM ET, 02/24/2026"

Empty_Cash ...999
"Symbol","Description","Qty (Quantity)","Price","Price Chng $ (Price Change $)","Price Chng % (Price Change %)","Mkt Val (Market Value)","Day Chng $ (Day Change $)","Day Chng % (Day Change %)","Cost Basis","Gain $ (Gain/Loss $)","Gain % (Gain/Loss %)","Ratings","Reinvest?","Reinvest Capital Gains?","% of Acct (% of Account)","Security Type",
"Cash & Cash Investments","--","--","--","--","--","$0.50","$0.00","0%","--","--","--","--","--","--","100%","Cash and Money Market",
"Account Total","","--","--","--","--","$0.50","$0.00","0%","$0.00","$0.00","0%","--","--","--","--","--",
`
    const positions = parseSchwabCsv(csv)
    expect(positions).toHaveLength(1)
    expect(positions[0]!.symbol).toBe('CASH')
    expect(positions[0]!.price).toBe(1.0)
    expect(positions[0]!.marketValue).toBe(0.50)
  })

  it('handles Windows line endings', () => {
    const csv = '"Positions for All-Accounts as of 08:50 PM ET, 02/24/2026"\r\n\r\nWin_Cash ...111\r\n"Symbol","Description","Qty (Quantity)","Price","Price Chng $ (Price Change $)","Price Chng % (Price Change %)","Mkt Val (Market Value)","Day Chng $ (Day Change $)","Day Chng % (Day Change %)","Cost Basis","Gain $ (Gain/Loss $)","Gain % (Gain/Loss %)","Ratings","Reinvest?","Reinvest Capital Gains?","% of Acct (% of Account)","Security Type",\r\n"SPY","S&P 500 ETF","10","500.00","2.00","0.4%","$5,000.00","$20.00","0.4%","$4,500.00","$500.00","11.11%","--","No","N/A","100%","ETFs & Closed End Funds",\r\n"Cash & Cash Investments","--","--","--","--","--","$0.00","$0.00","0%","--","--","--","--","--","--","0%","Cash and Money Market",\r\n"Account Total","","--","--","--","--","$5,000.00","$20.00","0.4%","$4,500.00","$500.00","11.11%","--","--","--","--","--",\r\n'
    const positions = parseSchwabCsv(csv)
    expect(positions).toHaveLength(2)
    expect(positions[0]!.symbol).toBe('SPY')
    expect(positions[0]!.price).toBe(500)
  })

  it('handles BOM', () => {
    const csv = '\uFEFF"Positions for All-Accounts as of 08:50 PM ET, 02/24/2026"\n\nBom_Cash ...222\n"Symbol","Description","Qty (Quantity)","Price","Price Chng $ (Price Change $)","Price Chng % (Price Change %)","Mkt Val (Market Value)","Day Chng $ (Day Change $)","Day Chng % (Day Change %)","Cost Basis","Gain $ (Gain/Loss $)","Gain % (Gain/Loss %)","Ratings","Reinvest?","Reinvest Capital Gains?","% of Acct (% of Account)","Security Type",\n"AGG","ISHARES AGG BOND","50","100.00","0.05","0.05%","$5,000.00","$2.50","0.05%","$4,900.00","$100.00","2.04%","--","No","N/A","100%","ETFs & Closed End Funds",\n"Cash & Cash Investments","--","--","--","--","--","$0.00","$0.00","0%","--","--","--","--","--","--","0%","Cash and Money Market",\n"Account Total","","--","--","--","--","$5,000.00","$2.50","0.05%","$4,900.00","$100.00","2.04%","--","--","--","--","--",\n'
    const positions = parseSchwabCsv(csv)
    expect(positions).toHaveLength(2)
    expect(positions[0]!.symbol).toBe('AGG')
    expect(positions[0]!.price).toBe(100)
  })

  it('handles zero market value', () => {
    const csv = `"Positions for All-Accounts as of 08:50 PM ET, 02/24/2026"

Zero_Cash ...333
"Symbol","Description","Qty (Quantity)","Price","Price Chng $ (Price Change $)","Price Chng % (Price Change %)","Mkt Val (Market Value)","Day Chng $ (Day Change $)","Day Chng % (Day Change %)","Cost Basis","Gain $ (Gain/Loss $)","Gain % (Gain/Loss %)","Ratings","Reinvest?","Reinvest Capital Gains?","% of Acct (% of Account)","Security Type",
"Cash & Cash Investments","--","--","--","--","--","$0.00","$0.00","0%","--","--","--","--","--","--","0%","Cash and Money Market",
"Account Total","","--","--","--","--","$0.00","$0.00","0%","$0.00","$0.00","0%","--","--","--","--","--",
`
    const positions = parseSchwabCsv(csv)
    expect(positions).toHaveLength(1)
    expect(positions[0]!.marketValue).toBe(0)
  })
})

describe('schwabToRebalanceInput', () => {
  it('converts positions to RebalanceInput with shares and inferred metadata', () => {
    const positions = [
      { account: 'Sam_Cash', symbol: 'VTI', description: '', quantity: 10, price: 250, marketValue: 2500, securityType: '' },
      { account: 'Sam_Cash', symbol: 'CASH', description: '', quantity: null, price: 1.0, marketValue: 100, securityType: '' },
    ]
    const result = schwabToRebalanceInput(positions)
    expect(result.holdings).toEqual([
      { account: 'Sam_Cash', symbol: 'VTI', shares: 10 },
      { account: 'Sam_Cash', symbol: 'CASH', shares: 100 },
    ])
    expect(result.accounts).toEqual([
      { name: 'Sam_Cash', tax_status: 'taxable', provider: 'schwab', owner: 'sam' },
    ])
    expect(result.symbols).toEqual([
      { name: 'VTI', price: 250 },
      { name: 'CASH', price: 1 },
    ])
  })

  it('merges with existing portfolio preserving symbol metadata', () => {
    const positions = [
      { account: 'Acct', symbol: 'VTI', description: '', quantity: 10, price: 250, marketValue: 2500, securityType: '' },
      { account: 'Acct', symbol: 'NEW', description: '', quantity: 5, price: 200, marketValue: 1000, securityType: '' },
    ]
    const existing = {
      holdings: [{ account: 'Acct', symbol: 'VTI', shares: 8 }],
      symbols: [
        { name: 'VTI', price: 240, countries: { us: 1 }, assets: { equity: 1 }, beta: 1.0 },
      ],
      accounts: [
        { name: 'Acct', tax_status: 'taxable', provider: 'schwab', owner: 'test' },
      ],
      targets: { VTI: 80, BND: 20 },
      strategy: 'consolidate' as const,
    }
    const result = schwabToRebalanceInput(positions, existing)

    // Holdings updated from Schwab (shares)
    expect(result.holdings[0]!.shares).toBe(10)

    // VTI preserves existing metadata but updates price
    const vti = result.symbols!.find(s => s.name === 'VTI')
    expect(vti!.countries).toEqual({ us: 1 })
    expect(vti!.price).toBe(250)

    // NEW has price from Schwab
    expect(result.symbols!.find(s => s.name === 'NEW')).toEqual({ name: 'NEW', price: 200 })

    // Account preserves existing metadata
    expect(result.accounts![0]!.owner).toBe('test')

    // Targets preserved
    expect(result.targets).toEqual({ VTI: 80, BND: 20 })
    expect(result.strategy).toBe('consolidate')
  })
})

describe('parseSchwabExport end-to-end', () => {
  it('parses synthetic Schwab CSV to valid RebalanceInput', () => {
    const csv = `"Positions for All-Accounts as of 05:00 PM ET, 01/01/2026"

Test_Roth_IRA ...100
"Symbol","Description","Qty (Quantity)","Price","Price Chng $ (Price Change $)","Price Chng % (Price Change %)","Mkt Val (Market Value)","Day Chng $ (Day Change $)","Day Chng % (Day Change %)","Cost Basis","Gain $ (Gain/Loss $)","Gain % (Gain/Loss %)","Ratings","Reinvest?","Reinvest Capital Gains?","% of Acct (% of Account)","Security Type",
"SPY","S&P 500 ETF","20","500.00","2.00","0.4%","$10,000.00","$40.00","0.4%","$8,000.00","$2,000.00","25%","--","No","N/A","90%","ETFs & Closed End Funds",
"Cash & Cash Investments","--","--","--","--","--","$1,000.00","$0.00","0%","--","--","--","--","--","--","10%","Cash and Money Market",
"Account Total","","--","--","--","--","$11,000.00","$40.00","0.36%","$8,000.00","$2,000.00","25%","--","--","--","--","--",


Test_Cash ...200
"Symbol","Description","Qty (Quantity)","Price","Price Chng $ (Price Change $)","Price Chng % (Price Change %)","Mkt Val (Market Value)","Day Chng $ (Day Change $)","Day Chng % (Day Change %)","Cost Basis","Gain $ (Gain/Loss $)","Gain % (Gain/Loss %)","Ratings","Reinvest?","Reinvest Capital Gains?","% of Acct (% of Account)","Security Type",
"AGG","ISHARES AGG BOND","100","100.00","0.10","0.1%","$10,000.00","$10.00","0.1%","$9,500.00","$500.00","5.26%","--","No","N/A","100%","ETFs & Closed End Funds",
"Cash & Cash Investments","--","--","--","--","--","$50.00","$0.00","0%","--","--","--","--","--","--","0%","Cash and Money Market",
"Account Total","","--","--","--","--","$10,050.00","$10.00","0.1%","$9,500.00","$500.00","5.26%","--","--","--","--","--",
`
    const result = parseSchwabExport(csv)

    expect(result.holdings).toHaveLength(4)
    expect(result.holdings[0]).toEqual({ account: 'Test_Roth_IRA', symbol: 'SPY', shares: 20 })
    expect(result.holdings[1]).toEqual({ account: 'Test_Roth_IRA', symbol: 'CASH', shares: 1000 })
    expect(result.holdings[2]).toEqual({ account: 'Test_Cash', symbol: 'AGG', shares: 100 })
    expect(result.holdings[3]).toEqual({ account: 'Test_Cash', symbol: 'CASH', shares: 50 })

    expect(result.accounts).toHaveLength(2)
    expect(result.accounts![0]).toEqual({ name: 'Test_Roth_IRA', tax_status: 'roth', provider: 'schwab', owner: 'test' })
    expect(result.accounts![1]).toEqual({ name: 'Test_Cash', tax_status: 'taxable', provider: 'schwab', owner: 'test' })

    // Symbols include prices
    expect(result.symbols!.find(s => s.name === 'SPY')!.price).toBe(500)
    expect(result.symbols!.find(s => s.name === 'AGG')!.price).toBe(100)
    expect(result.symbols!.find(s => s.name === 'CASH')!.price).toBe(1)

    // Roundtrip through portfolio CSV
    const portfolioCsv = toPortfolioCsv(result)
    const reparsed = parsePortfolioCsv(portfolioCsv)
    expect(reparsed.holdings).toEqual(result.holdings)
  })

  it('merge preserves existing symbols and targets', () => {
    const schwabCsv = `"Positions for All-Accounts as of 05:00 PM ET, 01/01/2026"

Acct_Cash ...100
"Symbol","Description","Qty (Quantity)","Price","Price Chng $ (Price Change $)","Price Chng % (Price Change %)","Mkt Val (Market Value)","Day Chng $ (Day Change $)","Day Chng % (Day Change %)","Cost Basis","Gain $ (Gain/Loss $)","Gain % (Gain/Loss %)","Ratings","Reinvest?","Reinvest Capital Gains?","% of Acct (% of Account)","Security Type",
"VTI","VANGUARD ETF","50","250.00","1.00","0.4%","$12,500.00","$50.00","0.4%","$10,000.00","$2,500.00","25%","--","No","N/A","100%","ETFs & Closed End Funds",
"Cash & Cash Investments","--","--","--","--","--","$0.00","$0.00","0%","--","--","--","--","--","--","0%","Cash and Money Market",
"Account Total","","--","--","--","--","$12,500.00","$50.00","0.4%","$10,000.00","$2,500.00","25%","--","--","--","--","--",
`
    const existingCsv = `#holdings
account,symbol,shares
Acct_Cash,VTI,44

#symbols
name,price,countries,assets,beta
VTI,240,us:1,equity:1,1.0

#targets
symbol,percent
VTI,100
`
    const existing = parsePortfolioCsv(existingCsv)
    const result = parseSchwabExport(schwabCsv, existing)

    // Holdings updated (shares from Schwab)
    expect(result.holdings[0]!.shares).toBe(50)

    // Symbol metadata preserved, price updated
    expect(result.symbols!.find(s => s.name === 'VTI')!.countries).toEqual({ us: 1 })
    expect(result.symbols!.find(s => s.name === 'VTI')!.price).toBe(250)

    // Targets preserved
    expect(result.targets).toEqual({ VTI: 100 })
  })
})
