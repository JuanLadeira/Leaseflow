import { useEffect, useReducer, useRef } from 'react'
import { API_URL } from '@/shared/api/config'
import { tokenStorage } from '@/shared/auth/tokenStorage'
import { i18n } from '@/shared/i18n'
import { currentLocale } from '@/shared/i18n/locale'
import { createSseParser } from '@/shared/lib/sse'

/** Discriminated union: each status carries exactly the data that makes sense for it. */
export type SuggestionState =
  | { status: 'idle' }
  | { status: 'streaming'; text: string }
  | { status: 'done'; text: string; model: string }
  | { status: 'error'; text: string; error: string }

type Action =
  | { type: 'start' }
  | { type: 'delta'; text: string }
  | { type: 'done'; model: string }
  | { type: 'error'; error: string }
  | { type: 'reset' }

export function suggestionReducer(state: SuggestionState, action: Action): SuggestionState {
  switch (action.type) {
    case 'start':
      return { status: 'streaming', text: '' }
    case 'delta':
      return state.status === 'streaming' ? { ...state, text: state.text + action.text } : state
    case 'done':
      return state.status === 'streaming'
        ? { status: 'done', text: state.text.trim(), model: action.model }
        : state
    case 'error':
      return { status: 'error', text: 'text' in state ? state.text : '', error: action.error }
    case 'reset':
      return { status: 'idle' }
  }
}

/**
 * Streams an AI-drafted reply for a lead. Uses fetch + ReadableStream instead
 * of EventSource because we need POST and an Authorization header.
 */
export function useReplySuggestion(leadId: number) {
  const [state, dispatch] = useReducer(suggestionReducer, { status: 'idle' })
  const controllerRef = useRef<AbortController | null>(null)

  const stop = () => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }

  // Abort an in-flight stream when the lead changes or the component unmounts.
  useEffect(() => {
    dispatch({ type: 'reset' })
    return stop
  }, [leadId])

  async function start() {
    stop()
    const controller = new AbortController()
    controllerRef.current = controller
    dispatch({ type: 'start' })
    try {
      const response = await fetch(`${API_URL}/leads/${leadId}/reply-suggestion`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenStorage.getAccess() ?? ''}`,
          // The draft goes to the lead, so it follows the lead's language; this is only a fallback.
          'Accept-Language': currentLocale(),
        },
        signal: controller.signal,
      })
      if (!response.ok || !response.body) throw new Error(i18n.t('leads:composer.failed', { status: response.status }))

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      const parse = createSseParser()
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        for (const event of parse(value)) {
          const payload = JSON.parse(event.data)
          if (event.event === 'delta') dispatch({ type: 'delta', text: payload.text })
          else if (event.event === 'done') dispatch({ type: 'done', model: payload.model })
          else if (event.event === 'error') dispatch({ type: 'error', error: payload.detail })
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        dispatch({ type: 'error', error: i18n.t('leads:composer.stopped') })
        return
      }
      dispatch({ type: 'error', error: err instanceof Error ? err.message : i18n.t('leads:composer.unknown') })
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }

  return { state, start, stop, reset: () => dispatch({ type: 'reset' }) }
}
