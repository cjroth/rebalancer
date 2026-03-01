/**
 * B4: Wizard with On-Demand Chat Modal
 *
 * The wizard runs normally. Press `/` at any time to open a chat overlay.
 * Chat history persists to disk in JSON format.
 */
import { useState, useCallback, useEffect } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { anthropic } from '@ai-sdk/anthropic'
import { useAIChat } from '../useAIChat.ts'
import { createPortfolioTools } from '../portfolio-tools.ts'
import { buildSystemPrompt } from '../system-prompt.ts'
import { loadPortfolioDataAsync } from '../../../src/screens/state.ts'
import { ChatModal } from './ChatModal.tsx'
import type { StorageAdapter } from '../../../src/screens/storage.ts'
import type { ChatMessage } from '../chat-ui/types.ts'
import type { CoreMessage } from 'ai'
import type { Holding, Symbol as PortfolioSymbol } from '../../../src/lib/types.ts'

import { Step1Import } from '../../../src/screens/import.tsx'
import { Step2Review } from '../../../src/screens/review.tsx'
import { Step3Targets } from '../../../src/screens/targets.tsx'
import { Step4Trades } from '../../../src/screens/trades.tsx'

interface PersistedChatHistory {
  messages: ChatMessage[]
  coreMessages: CoreMessage[]
}

interface ChatModalWizardProps {
  dataDir: string
  storage: StorageAdapter
  readFile: (path: string) => string
}

export function ChatModalWizard({ dataDir, storage, readFile }: ChatModalWizardProps) {
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
      initialHistory={initialHistory}
    />
  )
}

interface ChatModalWizardInnerProps extends ChatModalWizardProps {
  initialHistory: PersistedChatHistory | null
}

function ChatModalWizardInner({ dataDir, storage, readFile, initialHistory }: ChatModalWizardInnerProps) {
  const { exit } = useApp()
  const [currentStep, setCurrentStep] = useState(1)
  const [chatOpen, setChatOpen] = useState(false)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [symbols, setSymbols] = useState<PortfolioSymbol[]>([])

  // Load portfolio data for system prompt context
  useEffect(() => {
    loadPortfolioDataAsync(storage).then((data) => {
      if (data) {
        setHoldings(data.holdings)
        setSymbols(data.symbols)
      }
    })
  }, [currentStep])

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

  // Handle `/` key to open chat (only when chat is closed)
  useInput((input, _key) => {
    if (!chatOpen && input === '/') {
      setChatOpen(true)
    }
  })

  const handleStepComplete = useCallback(() => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    } else {
      exit()
      process.exit(0)
    }
  }, [currentStep, exit])

  const handleStepBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

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
