/**
 * Wizard with On-Demand Chat Modal
 *
 * The wizard runs normally. Press `/` at any time to open a chat overlay.
 * Chat history persists to disk in JSON format.
 * Press `z` to reset portfolio data and chat history.
 */
import { useState, useCallback, useEffect } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { anthropic } from '@ai-sdk/anthropic'
import { useAIChat } from './useAIChat.ts'
import { createPortfolioTools } from './portfolio-tools.ts'
import { buildSystemPrompt } from './system-prompt.ts'
import { loadPortfolioDataAsync, writeWizardStateAsync } from '../screens/state.ts'
import { ChatModal } from './ChatModal.tsx'
import type { StorageAdapter } from '../screens/storage.ts'
import type { ChatMessage } from './types.ts'
import type { CoreMessage } from 'ai'
import type { Holding, Symbol as PortfolioSymbol } from '../lib/types.ts'

import { Step1Import } from '../screens/import.tsx'
import { Step2Review } from '../screens/review.tsx'
import { Step3Targets } from '../screens/targets.tsx'
import { Step4Trades } from '../screens/trades.tsx'

interface PersistedChatHistory {
  messages: ChatMessage[]
  coreMessages: CoreMessage[]
}

interface ChatModalWizardProps {
  dataDir: string
  storage: StorageAdapter
  readFile: (path: string) => string
  initialStep: number
}

export function ChatModalWizard({ dataDir, storage, readFile, initialStep }: ChatModalWizardProps) {
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [initialHistory, setInitialHistory] = useState<PersistedChatHistory | null>(null)

  // Load persisted chat history on mount
  useEffect(() => {
    storage.read('chat-history.json').then((text) => {
      if (text) {
        try {
          setInitialHistory(JSON.parse(text) as PersistedChatHistory)
        } catch {
          // Ignore corrupt history
        }
      }
      setHistoryLoaded(true)
    })
  }, [])

  if (!historyLoaded) {
    return (
      <Box>
        <Text dimColor>Loading...</Text>
      </Box>
    )
  }

  return (
    <ChatModalWizardInner
      dataDir={dataDir}
      storage={storage}
      readFile={readFile}
      initialStep={initialStep}
      initialHistory={initialHistory}
    />
  )
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
      <Text>This will delete your imported portfolio data, targets, trades, and chat history.</Text>
      <Box marginTop={1}>
        <Text bold>y</Text><Text> to confirm, </Text>
        <Text bold>any other key</Text><Text> to cancel</Text>
      </Box>
    </Box>
  )
}

interface ChatModalWizardInnerProps extends ChatModalWizardProps {
  initialHistory: PersistedChatHistory | null
}

function ChatModalWizardInner({ dataDir, storage, readFile, initialStep, initialHistory }: ChatModalWizardInnerProps) {
  const { exit } = useApp()
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [chatOpen, setChatOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [symbols, setSymbols] = useState<PortfolioSymbol[]>([])
  const [resetCounter, setResetCounter] = useState(0)

  // Load portfolio data for system prompt context
  useEffect(() => {
    loadPortfolioDataAsync(storage).then((data) => {
      if (data) {
        setHoldings(data.holdings)
        setSymbols(data.symbols)
      }
    })
  }, [currentStep, resetCounter])

  const handleMessagesChange = useCallback(
    (messages: ChatMessage[], coreMessages: CoreMessage[]) => {
      storage.write(
        'chat-history.json',
        JSON.stringify({ messages, coreMessages } satisfies PersistedChatHistory, null, 2),
      )
    },
    [storage],
  )

  const tools = createPortfolioTools({
    storage,
    onShowWizardStep: (step: number) => {
      setCurrentStep(step)
      writeWizardStateAsync(storage, { currentStep: step })
      setChatOpen(false)
    },
  })

  const chat = useAIChat({
    model: anthropic('claude-sonnet-4-20250514'),
    systemPrompt: buildSystemPrompt({ currentStep, holdings, symbols }),
    tools,
    initialMessages: initialHistory?.messages,
    initialCoreMessages: initialHistory?.coreMessages,
    onMessagesChange: handleMessagesChange,
  })

  // Handle `/` key to open chat, `z` key for reset (only when chat is closed)
  useInput((input, _key) => {
    if (chatOpen || confirming) return
    if (input === '/') {
      setChatOpen(true)
    }
    if (input === 'z') {
      setConfirming(true)
    }
  })

  const goTo = useCallback((target: number) => {
    if (target < 1) return
    if (target > 4) {
      writeWizardStateAsync(storage, { currentStep: 1 })
      exit()
      process.exit(0)
      return
    }
    writeWizardStateAsync(storage, { currentStep: target })
    setCurrentStep(target)
  }, [storage, exit])

  const handleStepComplete = useCallback(() => {
    goTo(currentStep + 1)
  }, [currentStep, goTo])

  const handleStepBack = useCallback(() => {
    goTo(currentStep - 1)
  }, [currentStep, goTo])

  const requestReset = useCallback(() => {
    setConfirming(true)
  }, [])

  const doReset = useCallback(() => {
    const files = ['portfolio.csv', 'trades.csv', 'wizard-state.json', 'chat-history.json']
    for (const f of files) storage.remove(f)
    setConfirming(false)
    setHoldings([])
    setSymbols([])
    writeWizardStateAsync(storage, { currentStep: 1 })
    setCurrentStep(1)
    setResetCounter((c) => c + 1)
  }, [storage])

  const cancelReset = useCallback(() => {
    setConfirming(false)
  }, [])

  if (confirming) {
    return <ConfirmReset onConfirm={doReset} onCancel={cancelReset} />
  }

  // When chat is open, render the modal full-screen (hiding the wizard step)
  if (chatOpen) {
    return (
      <ChatModal
        messages={chat.messages}
        streamingText={chat.streamingText}
        isLoading={chat.isLoading}
        activeToolCalls={chat.activeToolCalls}
        onSendMessage={chat.sendMessage}
        onClose={() => setChatOpen(false)}
      />
    )
  }

  // Render the current wizard step
  const chatItem = { key: '/', label: 'chat' }
  const stepProps = {
    dataDir,
    storage,
    readFile,
    onComplete: handleStepComplete,
    onBack: handleStepBack,
    onReset: requestReset,
    extraStatusItems: [chatItem],
  }

  return (
    <Box flexDirection="column">
      {currentStep === 1 && <Step1Import {...stepProps} />}
      {currentStep === 2 && <Step2Review {...stepProps} />}
      {currentStep === 3 && <Step3Targets {...stepProps} />}
      {currentStep === 4 && <Step4Trades {...stepProps} />}
    </Box>
  )
}
