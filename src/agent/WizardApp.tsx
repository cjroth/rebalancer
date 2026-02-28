import { useState, useEffect, useCallback } from 'react'
import { ChatView } from './ChatView.tsx'
import { PortfolioView } from './PortfolioView.tsx'
import { emitter } from './bridge.ts'
import type { PortfolioData } from './bridge.ts'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

export function WizardApp() {
  const [mode, setMode] = useState<'chat' | 'portfolio'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [isWaiting, setIsWaiting] = useState(true)
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)

  useEffect(() => {
    const onShowPortfolio = (data: PortfolioData) => {
      setPortfolioData(data)
      setMode('portfolio')
    }

    const onHidePortfolio = () => {
      setMode('chat')
    }

    let streamBuffer = ''
    let flushTimer: ReturnType<typeof setTimeout> | null = null

    const onStreamToken = (delta: string) => {
      streamBuffer += delta
      if (!flushTimer) {
        flushTimer = setTimeout(() => {
          const buf = streamBuffer
          streamBuffer = ''
          flushTimer = null
          setStreamingText(prev => prev + buf)
        }, 50)
      }
    }

    const onAssistantMessage = (text: string) => {
      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
      streamBuffer = ''
      setMessages(prev => [...prev, { role: 'assistant', text }])
      setStreamingText('')
      setIsWaiting(false)
    }

    emitter.on('show_portfolio', onShowPortfolio)
    emitter.on('hide_portfolio', onHidePortfolio)
    emitter.on('stream_token', onStreamToken)
    emitter.on('assistant_message', onAssistantMessage)

    return () => {
      if (flushTimer) clearTimeout(flushTimer)
      emitter.off('show_portfolio', onShowPortfolio)
      emitter.off('hide_portfolio', onHidePortfolio)
      emitter.off('stream_token', onStreamToken)
      emitter.off('assistant_message', onAssistantMessage)
    }
  }, [])

  const onUserMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, { role: 'user', text }])
    setIsWaiting(true)
    setStreamingText('')
  }, [])

  if (mode === 'portfolio' && portfolioData) {
    return <PortfolioView {...portfolioData} />
  }

  return (
    <ChatView
      messages={messages}
      streamingText={streamingText}
      isWaiting={isWaiting}
      onUserMessage={onUserMessage}
    />
  )
}
