import { createDynamicTerminal } from 'ink-web/next'

type TerminalOptions = Parameters<typeof createDynamicTerminal>[1]

interface CreateOptions {
  rows?: number
  cols?: number
  className?: string
  termOptions?: Record<string, unknown>
}

function makeTermOpts(opts: CreateOptions = {}): TerminalOptions {
  return {
    rows: opts.rows ?? 24,
    cols: opts.cols,
    className: opts.className,
    termOptions: opts.termOptions,
  } as TerminalOptions
}

export function createWizard(opts: CreateOptions = {}) {
  return createDynamicTerminal(
    () => import('./screens/wizard.tsx').then(m => m.Wizard) as any,
    makeTermOpts(opts),
  )
}

export function createImportScreen(opts: CreateOptions = {}) {
  return createDynamicTerminal(
    () => import('./screens/import.tsx').then(m => m.Step1Import) as any,
    makeTermOpts(opts),
  )
}

export function createReviewScreen(opts: CreateOptions = {}) {
  return createDynamicTerminal(
    () => import('./screens/review.tsx').then(m => m.Step2Review) as any,
    makeTermOpts(opts),
  )
}

export function createTargetsScreen(opts: CreateOptions = {}) {
  return createDynamicTerminal(
    () => import('./screens/targets.tsx').then(m => m.Step3Targets) as any,
    makeTermOpts(opts),
  )
}

export function createTradesScreen(opts: CreateOptions = {}) {
  return createDynamicTerminal(
    () => import('./screens/trades.tsx').then(m => m.Step4Trades) as any,
    makeTermOpts(opts),
  )
}
