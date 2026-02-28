import { EventEmitter } from 'events'
import type { Symbol, Account, Holding } from '../lib/types.ts'

export interface PortfolioData {
  symbols: Symbol[]
  accounts: Account[]
  holdings: Holding[]
}

export const emitter = new EventEmitter()

// --- User message queue ---

const messageQueue: string[] = []
let resolveUserMessage: ((msg: string) => void) | null = null

export function waitForUserMessage(): Promise<string> {
  if (messageQueue.length > 0) {
    return Promise.resolve(messageQueue.shift()!)
  }
  return new Promise(resolve => {
    resolveUserMessage = resolve
  })
}

export function sendUserMessage(text: string) {
  if (resolveUserMessage) {
    const r = resolveUserMessage
    resolveUserMessage = null
    r(text)
  } else {
    messageQueue.push(text)
  }
}

// --- Portfolio show/hide coordination ---

let resolvePortfolioReturn: (() => void) | null = null

export function showPortfolio(data: PortfolioData): Promise<void> {
  return new Promise(resolve => {
    resolvePortfolioReturn = resolve
    emitter.emit('show_portfolio', data)
  })
}

export function returnFromPortfolio() {
  if (resolvePortfolioReturn) {
    const r = resolvePortfolioReturn
    resolvePortfolioReturn = null
    emitter.emit('hide_portfolio')
    r()
  }
}

// --- Streaming events (SDK → React) ---

export function emitStreamToken(delta: string) {
  emitter.emit('stream_token', delta)
}

export function emitAssistantMessage(text: string) {
  emitter.emit('assistant_message', text)
}
