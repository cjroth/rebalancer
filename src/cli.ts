import { render } from 'ink'
import React from 'react'
import { Wizard } from './screens/wizard.tsx'
import { Step1Import } from './screens/import.tsx'
import { Step2Review } from './screens/review.tsx'
import { Step3Targets } from './screens/targets.tsx'
import { Step4Trades } from './screens/trades.tsx'
import { ensureDataDir, readWizardState } from './screens/state.ts'

const SUBCOMMANDS = new Set(['import', 'review', 'targets', 'trades'])
const arg = process.argv[2]
const subcommand = arg && SUBCOMMANDS.has(arg) ? arg : undefined
const dataDirArg = subcommand ? process.argv[3] : arg
const dataDir = dataDirArg || './portfolio-data'
ensureDataDir(dataDir)

function exit() {
  process.exit(0)
}

switch (subcommand) {
  case 'import':
    render(React.createElement(Step1Import, { dataDir, onComplete: exit }))
    break
  case 'review':
    render(React.createElement(Step2Review, { dataDir, onComplete: exit }))
    break
  case 'targets':
    render(React.createElement(Step3Targets, { dataDir, onComplete: exit }))
    break
  case 'trades':
    render(React.createElement(Step4Trades, { dataDir, onComplete: exit }))
    break
  default: {
    const state = readWizardState(dataDir)
    render(React.createElement(Wizard, { dataDir, initialStep: state.currentStep }))
    break
  }
}
