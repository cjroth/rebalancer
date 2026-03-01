import { createContext, useContext, useReducer, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { ChatState, ChatAction } from './types.ts'
import { chatReducer, initialChatState } from './types.ts'

interface ChatContextValue {
  state: ChatState
  dispatch: (action: ChatAction) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

interface ChatProviderProps {
  children: ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [state, dispatch] = useReducer(chatReducer, undefined, initialChatState)

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])

  return (
    <ChatContext value={value}>
      {children}
    </ChatContext>
  )
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return ctx
}
