import { render } from 'ink'
import * as fs from 'fs'
import React from 'react'
import { Wizard } from './screens/wizard.tsx'
import { Step1Import } from './screens/import.tsx'
import { Step2Review } from './screens/review.tsx'
import { Step3Targets } from './screens/targets.tsx'
import { Step4Trades } from './screens/trades.tsx'
import { readWizardStateAsync } from './screens/state.ts'
import { FsStorageAdapter } from './screens/fs-storage.ts'

const SUBCOMMANDS = new Set(['import', 'review', 'targets', 'trades'])
const arg = process.argv[2]
const subcommand = arg && SUBCOMMANDS.has(arg) ? arg : undefined
const dataDirArg = subcommand ? process.argv[3] : arg
const dataDir = dataDirArg || './portfolio-data'
const storage = new FsStorageAdapter(dataDir)

const readFile = (path: string) => fs.readFileSync(path, 'utf-8')

function exit() {
  process.exit(0)
}

async function main() {
  switch (subcommand) {
    case 'import':
      render(React.createElement(Step1Import, { dataDir, storage, readFile, onComplete: exit }))
      break
    case 'review':
      render(React.createElement(Step2Review, { dataDir, storage, onComplete: exit }))
      break
    case 'targets':
      render(React.createElement(Step3Targets, { dataDir, storage, onComplete: exit }))
      break
    case 'trades':
      render(React.createElement(Step4Trades, { dataDir, storage, onComplete: exit }))
      break
    default: {
      const state = await readWizardStateAsync(storage)
      render(React.createElement(Wizard, { dataDir, storage, readFile, initialStep: state.currentStep }))
      break
    }
  }
}

main()
