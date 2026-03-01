import { describe, expect, test } from 'bun:test'
import { buildSystemPrompt } from './system-prompt'
import type { Holding, Symbol } from '../lib/types'

describe('buildSystemPrompt', () => {
  test('base prompt without options', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('portfolio rebalancing assistant')
    expect(prompt).toContain('4-step wizard')
    expect(prompt).toContain('Import')
    expect(prompt).toContain('Review')
    expect(prompt).toContain('Targets')
    expect(prompt).toContain('Trades')
    expect(prompt).toContain('Guidelines')
  })

  test('includes step number when currentStep provided', () => {
    const prompt = buildSystemPrompt({ currentStep: 3 })
    expect(prompt).toContain('Step 3 of the wizard')
  })

  test('does not include step text when currentStep is 0/undefined', () => {
    const prompt = buildSystemPrompt({ currentStep: 0 })
    expect(prompt).not.toContain('Step 0')

    const prompt2 = buildSystemPrompt({})
    expect(prompt2).not.toContain('currently on Step')
  })

  test('includes holdings markdown when provided', () => {
    const holdings: Holding[] = [
      { account: 'roth', symbol: 'VTI', shares: 100, price: 200, amount: 20000 },
    ]
    const prompt = buildSystemPrompt({ holdings })
    expect(prompt).toContain('VTI')
    expect(prompt).toContain('roth')
  })

  test('does not include holdings when empty', () => {
    const prompt = buildSystemPrompt({ holdings: [] })
    // Should not have holdings table
    expect(prompt).not.toContain('Account')
  })

  test('includes target table when symbols have targets', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 200, countries: { us: 1 }, assets: { equity: 1 }, beta: 1, targetPercent: 60 },
      { name: 'VXUS', price: 50, countries: { intl: 1 }, assets: { equity: 1 }, beta: 1, targetPercent: 40 },
    ]
    const prompt = buildSystemPrompt({ symbols })
    expect(prompt).toContain('Target Allocations')
    expect(prompt).toContain('VTI')
    expect(prompt).toContain('60%')
    expect(prompt).toContain('VXUS')
    expect(prompt).toContain('40%')
  })

  test('does not include target table when no symbols have targets', () => {
    const symbols: Symbol[] = [
      { name: 'VTI', price: 200, countries: { us: 1 }, assets: { equity: 1 }, beta: 1 },
    ]
    const prompt = buildSystemPrompt({ symbols })
    expect(prompt).not.toContain('Target Allocations')
  })
})
