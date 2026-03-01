import { useState, useCallback, useRef } from 'react'
import { streamText } from 'ai'
import type { LanguageModel, CoreMessage, CoreTool } from 'ai'
import type { ChatMessage, ToolCall } from './chat-ui/types.ts'
import { createMessageId } from './chat-ui/types.ts'

interface UseAIChatOptions {
  model: LanguageModel
  systemPrompt: string
  tools?: Record<string, CoreTool>
  maxSteps?: number
  initialMessages?: ChatMessage[]
  initialCoreMessages?: CoreMessage[]
  onMessagesChange?: (messages: ChatMessage[], coreMessages: CoreMessage[]) => void
}

interface UseAIChatReturn {
  messages: ChatMessage[]
  streamingText: string
  isLoading: boolean
  activeToolCalls: ToolCall[]
  sendMessage: (text: string) => void
  cancel: () => void
  addSystemMessage: (content: string) => void
}

export function useAIChat({
  model,
  systemPrompt,
  tools = {},
  maxSteps = 5,
  initialMessages,
  initialCoreMessages,
  onMessagesChange,
}: UseAIChatOptions): UseAIChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? [])
  const [streamingText, setStreamingText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const coreMessagesRef = useRef<CoreMessage[]>(initialCoreMessages ?? [])
  const onMessagesChangeRef = useRef(onMessagesChange)
  onMessagesChangeRef.current = onMessagesChange

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return

      // Add user message
      const userMsg: ChatMessage = {
        id: createMessageId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)
      setStreamingText('')
      setActiveToolCalls([])

      // Build core messages for the API
      coreMessagesRef.current.push({ role: 'user', content: text })

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const result = streamText({
          model,
          system: systemPrompt,
          messages: coreMessagesRef.current,
          tools,
          maxSteps,
          abortSignal: controller.signal,
          onStepFinish: ({ toolCalls, toolResults }) => {
            if (toolCalls && toolCalls.length > 0) {
              const tcs: ToolCall[] = toolCalls.map((tc, i) => ({
                id: tc.toolCallId,
                name: tc.toolName,
                args: tc.args as Record<string, unknown>,
                status: toolResults?.[i] ? 'complete' : 'calling',
                result: toolResults?.[i]
                  ? String((toolResults[i] as { result?: unknown }).result ?? toolResults[i])
                  : undefined,
              }))
              setActiveToolCalls(tcs)
            }
          },
        })

        let accumulated = ''
        for await (const delta of result.textStream) {
          accumulated += delta
          setStreamingText(accumulated)
        }

        // Sync core messages with response (includes tool call/result messages)
        const { messages: responseMessages } = await result.response
        // Remove the last user message we pushed (the SDK response includes proper context)
        // and replace with the full response messages
        coreMessagesRef.current = [
          ...coreMessagesRef.current.slice(0, -1), // everything before last user msg
          { role: 'user' as const, content: text }, // the user message
          ...responseMessages as CoreMessage[], // assistant + tool messages from response
        ]

        // Finalize: add assistant message
        const finalText = accumulated || (await result.text)
        if (finalText) {
          const assistantMsg: ChatMessage = {
            id: createMessageId(),
            role: 'assistant',
            content: finalText,
            timestamp: Date.now(),
          }
          setMessages((prev) => {
            const updated = [...prev, assistantMsg]
            onMessagesChangeRef.current?.(updated, [...coreMessagesRef.current])
            return updated
          })
        } else {
          // Model produced no text (e.g. only tool calls) — show tool results as fallback
          const steps = await result.steps
          const lastToolResults = steps
            .flatMap((s) => s.toolResults ?? [])
            .map((tr) => String((tr as { output?: unknown }).output ?? tr))
            .filter(Boolean)
          if (lastToolResults.length > 0) {
            const assistantMsg: ChatMessage = {
              id: createMessageId(),
              role: 'assistant',
              content: lastToolResults.join('\n\n'),
              timestamp: Date.now(),
            }
            setMessages((prev) => {
              const updated = [...prev, assistantMsg]
              onMessagesChangeRef.current?.(updated, [...coreMessagesRef.current])
              return updated
            })
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Cancelled, no-op
        } else {
          const errorMsg: ChatMessage = {
            id: createMessageId(),
            role: 'assistant',
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
            timestamp: Date.now(),
          }
          setMessages((prev) => [...prev, errorMsg])
        }
      } finally {
        setStreamingText('')
        setIsLoading(false)
        setActiveToolCalls([])
        abortRef.current = null
      }
    },
    [model, systemPrompt, tools, maxSteps, isLoading],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const addSystemMessage = useCallback((content: string) => {
    coreMessagesRef.current.push({ role: 'user', content: `[System: ${content}]` })
  }, [])

  return {
    messages,
    streamingText,
    isLoading,
    activeToolCalls,
    sendMessage,
    cancel,
    addSystemMessage,
  }
}
