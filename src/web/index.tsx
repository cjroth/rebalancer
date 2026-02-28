import { useState, useEffect, useCallback, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { Box, Text } from 'ink'
import { InkXterm, useFileDrop } from 'ink-web'
import { CornerRibbon } from '../components/made-with-ink-web'
import type { DroppedFile } from 'ink-web'
import 'xterm/css/xterm.css'

import Yoga from 'yoga-layout'
;(globalThis as any).__yogaPromise = Promise.resolve(Yoga)

import { Wizard } from '../screens/wizard.tsx'
import { OpfsStorageAdapter } from '../screens/storage.ts'
import { readWizardStateAsync, loadPortfolioAsync, loadPortfolioDataAsync } from '../screens/state.ts'
import type { RebalanceInput, Symbol, Account, Holding } from '../lib/types.ts'

interface InitState {
  initialStep: number
  portfolio: RebalanceInput | null
  portfolioData: { symbols: Symbol[]; accounts: Account[]; holdings: Holding[] } | null
}

function WebWizard() {
  const storage = useMemo(() => new OpfsStorageAdapter(), [])
  const [init, setInit] = useState<InitState | null>(null)
  const [droppedCsv, setDroppedCsv] = useState<string | null>(null)

  // Listen for file drops at the top level and pass content down
  useFileDrop(useCallback((file: DroppedFile) => {
    setDroppedCsv(file.content)
  }, []))

  useEffect(() => {
    async function load() {
      try {
        const state = await readWizardStateAsync(storage)
        const portfolio = await loadPortfolioAsync(storage)
        let portfolioData: InitState['portfolioData'] = null
        if (portfolio) {
          portfolioData = await loadPortfolioDataAsync(storage)
        }
        setInit({ initialStep: state.currentStep, portfolio, portfolioData })
      } catch (err) {
        console.error('Failed to load state:', err)
        setInit({ initialStep: 1, portfolio: null, portfolioData: null })
      }
    }
    load()
  }, [storage])

  if (!init) {
    return (
      <Box paddingX={1}>
        <Text dimColor>Loading...</Text>
      </Box>
    )
  }

  return (
    <Wizard
      storage={storage}
      initialStep={init.initialStep}
      preloadedPortfolio={init.portfolio}
      preloadedData={init.portfolioData}
      droppedCsv={droppedCsv}
      onDropConsumed={() => setDroppedCsv(null)}
    />
  )
}

function App() {
  return (
    <div style={{
      position: 'relative',
      borderRadius: '16px',
      border: '1px solid oklch(1 0 0 / 10%)',
      backgroundColor: 'oklch(0.205 0 0)',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      overflow: 'hidden',
      width: 'min(900px, 90vw)',
      height: 'min(600px, 85vh)',
      display: 'flex',
      flexDirection: 'column' as const,
    }}>
      <CornerRibbon position="top-right" absolute textColor="#5ec4c4" />
      {/* Title Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '10px 12px',
        borderBottom: '1px solid oklch(1 0 0 / 10%)',
        backgroundColor: 'oklch(0.18 0 0)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f57', display: 'inline-block' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#febc2e', display: 'inline-block' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#28c840', display: 'inline-block' }} />
        </div>
        <span style={{ fontSize: '13px', color: 'oklch(0.708 0 0)', userSelect: 'none' }}>Portfolio Rebalancer</span>
        <div />
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <InkXterm
          focus
          termOptions={{
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
              background: '#171717',
              foreground: '#fafafa',
            },
          }}
        >
          <WebWizard />
        </InkXterm>
      </div>
    </div>
  )
}

const container = document.getElementById('app')
if (container) {
  const root = createRoot(container)
  root.render(<App />)
}
