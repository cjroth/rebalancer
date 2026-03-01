/**
 * Chat UI types — pure data types with no Node.js dependencies.
 * Safe to use in browser and terminal environments.
 */

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  timestamp?: number
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  status: 'calling' | 'complete' | 'error'
  result?: string
}

export interface ChatState {
  messages: ChatMessage[]
  streamingText: string
  isLoading: boolean
  activeToolCalls: ToolCall[]
  error: string | null
}

export type ChatAction =
  | { type: 'add_message'; message: ChatMessage }
  | { type: 'set_streaming'; text: string }
  | { type: 'set_loading'; loading: boolean }
  | { type: 'set_tool_calls'; toolCalls: ToolCall[] }
  | { type: 'update_tool_call'; id: string; status: ToolCall['status']; result?: string }
  | { type: 'set_error'; error: string | null }
  | { type: 'clear' }

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'add_message':
      return {
        ...state,
        messages: [...state.messages, action.message],
        streamingText: '',
      }
    case 'set_streaming':
      return { ...state, streamingText: action.text }
    case 'set_loading':
      return { ...state, isLoading: action.loading }
    case 'set_tool_calls':
      return { ...state, activeToolCalls: action.toolCalls }
    case 'update_tool_call':
      return {
        ...state,
        activeToolCalls: state.activeToolCalls.map((tc) =>
          tc.id === action.id
            ? { ...tc, status: action.status, result: action.result }
            : tc
        ),
      }
    case 'set_error':
      return { ...state, error: action.error }
    case 'clear':
      return initialChatState()
  }
}

export function initialChatState(): ChatState {
  return {
    messages: [],
    streamingText: '',
    isLoading: false,
    activeToolCalls: [],
    error: null,
  }
}

let _messageCounter = 0
export function createMessageId(): string {
  return `msg_${Date.now()}_${++_messageCounter}`
}
