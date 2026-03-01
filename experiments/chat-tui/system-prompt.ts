import type { Holding, Symbol } from '../../src/lib/types.ts'
import { formatHoldingsMarkdown } from '../../src/lib/format.ts'

interface BuildSystemPromptOptions {
  holdings?: Holding[]
  symbols?: Symbol[]
  currentStep?: number
}

export function buildSystemPrompt(options: BuildSystemPromptOptions = {}): string {
  const { holdings, symbols, currentStep } = options

  const parts: string[] = []

  parts.push(`You are a helpful portfolio rebalancing assistant. You guide users through a 4-step wizard:`)
  parts.push(`1. **Import** — Load holdings from CSV`)
  parts.push(`2. **Review** — Explore the portfolio`)
  parts.push(`3. **Targets** — Set target allocation percentages`)
  parts.push(`4. **Trades** — Calculate rebalancing trades`)
  parts.push('')
  parts.push(`You have tools to interact with the portfolio data. ALWAYS use the tools when the user asks about their portfolio, holdings, allocations, targets, or trades — never guess or make up data.`)
  parts.push(`Be concise, helpful, and explain financial concepts when asked.`)

  if (currentStep) {
    parts.push('')
    parts.push(`The user is currently on Step ${currentStep} of the wizard.`)
  }

  if (holdings && holdings.length > 0) {
    parts.push('')
    parts.push(formatHoldingsMarkdown(holdings))
  }

  if (symbols && symbols.length > 0) {
    const withTargets = symbols.filter((s) => s.targetPercent && s.targetPercent > 0)
    if (withTargets.length > 0) {
      parts.push('')
      parts.push(`## Target Allocations`)
      parts.push('| Symbol | Target % |')
      parts.push('|--------|--------:|')
      for (const s of withTargets) {
        parts.push(`| ${s.name} | ${s.targetPercent}% |`)
      }
    }
  }

  parts.push('')
  parts.push(`## Guidelines`)
  parts.push(`- ALWAYS call get_portfolio, get_targets, or other tools when the user asks about their data — never guess`)
  parts.push(`- Use the show_wizard_step tool to display wizard step UIs when appropriate`)
  parts.push(`- When the user wants to set targets, first call get_portfolio to see their holdings, then suggest reasonable allocations`)
  parts.push(`- When the user asks about trades or rebalancing, call calculate_trades to get actual numbers`)

  return parts.join('\n')
}
