import { describe, expect, test } from 'bun:test'
import { createPortfolioTools } from './portfolio-tools'
import type { StorageAdapter } from '../screens/storage'

/** In-memory StorageAdapter for testing — no mocks. */
class InMemoryStorage implements StorageAdapter {
  private store = new Map<string, string>()

  async read(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async write(key: string, data: string): Promise<void> {
    this.store.set(key, data)
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key)
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key)
  }
}

const SAMPLE_CSV = `#holdings
account,symbol,shares
roth,VTI,100
roth,VXUS,50
taxable,BND,100

#symbols
name,price,countries,assets,beta
VTI,200,us:1,equity:1,1.0
VXUS,50,intl:1,equity:1,1.0
BND,100,us:1,bonds:1,0.2

#accounts
name,tax_status,provider,owner
roth,tax_deferred,fidelity,me
taxable,taxable,fidelity,me
`

describe('createPortfolioTools', () => {
  test('returns object with all 6 tool keys', () => {
    const storage = new InMemoryStorage()
    const tools = createPortfolioTools({ storage })
    const keys = Object.keys(tools)
    expect(keys).toContain('get_portfolio')
    expect(keys).toContain('get_portfolio_table')
    expect(keys).toContain('get_targets')
    expect(keys).toContain('set_targets')
    expect(keys).toContain('calculate_trades')
    expect(keys).toContain('show_wizard_step')
    expect(keys.length).toBe(6)
  })

  test('get_portfolio returns no-portfolio message with empty storage', async () => {
    const storage = new InMemoryStorage()
    const tools = createPortfolioTools({ storage })
    const result = await tools.get_portfolio.execute({}, { toolCallId: 'tc1', messages: [], abortSignal: undefined as any })
    expect(result).toContain('No portfolio loaded')
  })

  test('get_targets returns no-portfolio message with empty storage', async () => {
    const storage = new InMemoryStorage()
    const tools = createPortfolioTools({ storage })
    const result = await tools.get_targets.execute({}, { toolCallId: 'tc1', messages: [], abortSignal: undefined as any })
    expect(result).toContain('No portfolio loaded')
  })

  test('get_portfolio returns holdings when portfolio is loaded', async () => {
    const storage = new InMemoryStorage()
    await storage.write('portfolio.csv', SAMPLE_CSV)
    const tools = createPortfolioTools({ storage })
    const result = await tools.get_portfolio.execute({}, { toolCallId: 'tc1', messages: [], abortSignal: undefined as any })
    expect(result).toContain('VTI')
    expect(result).toContain('VXUS')
    expect(result).toContain('BND')
  })

  test('set_targets rejects targets not summing to 100', async () => {
    const storage = new InMemoryStorage()
    await storage.write('portfolio.csv', SAMPLE_CSV)
    const tools = createPortfolioTools({ storage })
    const result = await tools.set_targets.execute(
      { targets: { VTI: 50, VXUS: 30 } },
      { toolCallId: 'tc1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toContain('must sum to 100%')
  })

  test('set_targets saves valid targets', async () => {
    const storage = new InMemoryStorage()
    await storage.write('portfolio.csv', SAMPLE_CSV)
    const tools = createPortfolioTools({ storage })
    const result = await tools.set_targets.execute(
      { targets: { VTI: 50, VXUS: 30, BND: 20 } },
      { toolCallId: 'tc1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toContain('Targets updated')
    expect(result).toContain('50%')
    expect(result).toContain('30%')
    expect(result).toContain('20%')
  })

  test('show_wizard_step calls the callback', async () => {
    const storage = new InMemoryStorage()
    let calledWith: number | null = null
    const tools = createPortfolioTools({
      storage,
      onShowWizardStep: (step) => { calledWith = step },
    })
    const result = await tools.show_wizard_step.execute(
      { step: 3 },
      { toolCallId: 'tc1', messages: [], abortSignal: undefined as any },
    )
    expect(calledWith).toBe(3)
    expect(result).toContain('Step 3')
    expect(result).toContain('Targets')
  })

  test('show_wizard_step returns fallback when no callback', async () => {
    const storage = new InMemoryStorage()
    const tools = createPortfolioTools({ storage })
    const result = await tools.show_wizard_step.execute(
      { step: 1 },
      { toolCallId: 'tc1', messages: [], abortSignal: undefined as any },
    )
    expect(result).toContain('not available')
  })
})
