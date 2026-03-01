import { describe, expect, test } from 'bun:test'
import { chatReducer, initialChatState, createMessageId } from './types'
import type { ChatState, ChatMessage } from './types'

describe('initialChatState', () => {
  test('returns correct defaults', () => {
    const state = initialChatState()
    expect(state.messages).toEqual([])
    expect(state.streamingText).toBe('')
    expect(state.isLoading).toBe(false)
    expect(state.activeToolCalls).toEqual([])
    expect(state.error).toBeNull()
  })
})

describe('createMessageId', () => {
  test('returns unique IDs', () => {
    const id1 = createMessageId()
    const id2 = createMessageId()
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^msg_\d+_\d+$/)
    expect(id2).toMatch(/^msg_\d+_\d+$/)
  })
})

describe('chatReducer', () => {
  test('add_message appends message and clears streaming', () => {
    const state: ChatState = { ...initialChatState(), streamingText: 'partial' }
    const msg: ChatMessage = { id: '1', role: 'user', content: 'hello' }
    const next = chatReducer(state, { type: 'add_message', message: msg })
    expect(next.messages).toEqual([msg])
    expect(next.streamingText).toBe('')
  })

  test('set_streaming updates streaming text', () => {
    const state = initialChatState()
    const next = chatReducer(state, { type: 'set_streaming', text: 'hello' })
    expect(next.streamingText).toBe('hello')
  })

  test('set_loading updates loading state', () => {
    const state = initialChatState()
    const next = chatReducer(state, { type: 'set_loading', loading: true })
    expect(next.isLoading).toBe(true)
  })

  test('set_tool_calls sets active tool calls', () => {
    const state = initialChatState()
    const tcs = [{ id: 'tc1', name: 'get_portfolio', args: {}, status: 'calling' as const }]
    const next = chatReducer(state, { type: 'set_tool_calls', toolCalls: tcs })
    expect(next.activeToolCalls).toEqual(tcs)
  })

  test('update_tool_call updates a specific tool call', () => {
    const state: ChatState = {
      ...initialChatState(),
      activeToolCalls: [
        { id: 'tc1', name: 'get_portfolio', args: {}, status: 'calling' },
        { id: 'tc2', name: 'get_targets', args: {}, status: 'calling' },
      ],
    }
    const next = chatReducer(state, { type: 'update_tool_call', id: 'tc1', status: 'complete', result: 'done' })
    expect(next.activeToolCalls[0]!.status).toBe('complete')
    expect(next.activeToolCalls[0]!.result).toBe('done')
    expect(next.activeToolCalls[1]!.status).toBe('calling')
  })

  test('set_error updates error', () => {
    const state = initialChatState()
    const next = chatReducer(state, { type: 'set_error', error: 'oops' })
    expect(next.error).toBe('oops')

    const cleared = chatReducer(next, { type: 'set_error', error: null })
    expect(cleared.error).toBeNull()
  })

  test('clear resets to initial state', () => {
    const state: ChatState = {
      messages: [{ id: '1', role: 'user', content: 'hi' }],
      streamingText: 'partial',
      isLoading: true,
      activeToolCalls: [{ id: 'tc1', name: 'test', args: {}, status: 'calling' }],
      error: 'some error',
    }
    const next = chatReducer(state, { type: 'clear' })
    expect(next).toEqual(initialChatState())
  })
})
