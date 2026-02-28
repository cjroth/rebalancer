import { useState } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { writeWizardState, writeWizardStateAsync } from './state.ts'
import { Step1Import } from './import.tsx'
import { Step2Review } from './review.tsx'
import { Step3Targets } from './targets.tsx'
import { Step4Trades } from './trades.tsx'
import type { StorageAdapter } from './storage.ts'
import type { RebalanceInput, Symbol, Account, Holding } from '../lib/types.ts'
import * as fs from 'fs'
import { join } from 'path'

export interface WizardProps {
  /** Terminal mode: data directory path */
  dataDir?: string
  /** Browser mode: storage adapter */
  storage?: StorageAdapter
  /** Initial step to start on */
  initialStep: number
  /** Pre-loaded portfolio data (browser mode, from OPFS pre-load) */
  preloadedPortfolio?: RebalanceInput | null
  /** Pre-loaded portfolio data (browser mode) */
  preloadedData?: { symbols: Symbol[]; accounts: Account[]; holdings: Holding[] } | null
  /** Browser mode: CSV text from a file drop */
  droppedCsv?: string | null
  /** Browser mode: callback to clear droppedCsv after consumption */
  onDropConsumed?: () => void
}

function ConfirmReset({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  useInput((input, _key) => {
    if (input === 'y' || input === 'Y') {
      onConfirm()
    } else {
      onCancel()
    }
  })

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold color="yellow">Reset everything and start over?</Text>
      <Text>This will delete your imported portfolio data, targets, and trades.</Text>
      <Box marginTop={1}>
        <Text bold>y</Text><Text> to confirm, </Text>
        <Text bold>any other key</Text><Text> to cancel</Text>
      </Box>
    </Box>
  )
}

export function Wizard({ dataDir, storage, initialStep, preloadedPortfolio, preloadedData, droppedCsv, onDropConsumed }: WizardProps) {
  const { exit } = useApp()
  const [step, setStep] = useState(initialStep)
  const [confirming, setConfirming] = useState(false)
  // Browser mode: track portfolio state in memory after imports/saves
  const [portfolioInput, setPortfolioInput] = useState<RebalanceInput | null>(preloadedPortfolio ?? null)
  const [portfolioData, setPortfolioData] = useState(preloadedData ?? null)

  const isBrowser = !!storage

  const goTo = (target: number) => {
    if (target < 1) return
    if (target > 4) {
      if (isBrowser) {
        writeWizardStateAsync(storage!, { currentStep: 1 })
      } else {
        writeWizardState(dataDir!, { currentStep: 1 })
      }
      exit()
      return
    }
    if (isBrowser) {
      writeWizardStateAsync(storage!, { currentStep: target })
    } else {
      writeWizardState(dataDir!, { currentStep: target })
    }
    setStep(target)
  }

  const advance = () => goTo(step + 1)
  const goBack = () => goTo(step - 1)
  const requestReset = () => setConfirming(true)

  const doReset = () => {
    if (isBrowser) {
      const files = ['portfolio.csv', 'trades.csv', 'wizard-state.json']
      for (const f of files) storage!.remove(f)
      setPortfolioInput(null)
      setPortfolioData(null)
    } else {
      const files = ['portfolio.csv', 'trades.csv', 'wizard-state.json']
      for (const f of files) {
        const p = join(dataDir!, f)
        if (fs.existsSync(p)) fs.unlinkSync(p)
      }
    }
    setConfirming(false)
    if (isBrowser) {
      writeWizardStateAsync(storage!, { currentStep: 1 })
    } else {
      writeWizardState(dataDir!, { currentStep: 1 })
    }
    setStep(1)
  }

  const cancelReset = () => setConfirming(false)

  // Callback for step1 to update in-memory portfolio state (browser mode)
  const onPortfolioImported = (input: RebalanceInput, data: { symbols: Symbol[]; accounts: Account[]; holdings: Holding[] }) => {
    setPortfolioInput(input)
    setPortfolioData(data)
  }

  if (confirming) {
    return <ConfirmReset onConfirm={doReset} onCancel={cancelReset} />
  }

  const commonProps = {
    dataDir: dataDir ?? '',
    storage,
    onReset: requestReset,
    portfolioInput,
    portfolioData,
    droppedCsv,
    onDropConsumed,
  }

  switch (step) {
    case 1:
      return <Step1Import {...commonProps} onComplete={advance} onPortfolioImported={onPortfolioImported} />
    case 2:
      return <Step2Review {...commonProps} onComplete={advance} onBack={goBack} />
    case 3:
      return <Step3Targets {...commonProps} onComplete={advance} onBack={goBack} onPortfolioImported={onPortfolioImported} />
    case 4:
      return <Step4Trades {...commonProps} onComplete={advance} onBack={goBack} />
    default:
      return <Step1Import {...commonProps} onComplete={advance} onPortfolioImported={onPortfolioImported} />
  }
}
