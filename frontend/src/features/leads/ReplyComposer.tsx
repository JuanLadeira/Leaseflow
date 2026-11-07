import { useActionState, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { useSendMessageMutation } from './leadsApi'
import styles from './LeadDetailPage.module.css'
import { useReplySuggestion } from '@/features/assistant'
import { useToast } from '@/shared/ui/toastContext'

type SendState = { status: 'idle' } | { status: 'sent' } | { status: 'error'; message: string }

/**
 * Reply box with an AI assistant.
 * - The suggestion streams token by token into a preview the agent can accept.
 * - Sending uses a React 19 form action + useActionState (pending + result state
 *   without hand-rolled isSubmitting flags).
 */
export function ReplyComposer({ leadId }: { leadId: number }) {
  const [draft, setDraft] = useState('')
  const [fromAi, setFromAi] = useState(false)
  const [sendMessage] = useSendMessageMutation()
  const suggestion = useReplySuggestion(leadId)
  const notify = useToast()
  const { state } = suggestion

  const [sendState, formAction, isSending] = useActionState<SendState, FormData>(
    async (_previous, formData) => {
      const body = String(formData.get('body') ?? '').trim()
      if (!body) return { status: 'error', message: 'Write a message first.' }
      try {
        await sendMessage({ leadId, body, aiGenerated: fromAi }).unwrap()
        setDraft('')
        setFromAi(false)
        suggestion.reset()
        notify('Reply sent')
        return { status: 'sent' }
      } catch {
        return { status: 'error', message: 'Message not sent. Try again.' }
      }
    },
    { status: 'idle' },
  )

  const isStreaming = state.status === 'streaming'
  const suggestionText = state.status === 'idle' ? '' : state.text

  return (
    <div className={styles.composer}>
      <div className={styles.assistant} aria-labelledby="assistant-title">
        <div className={styles.assistantHeader}>
          <h3 id="assistant-title" className={styles.assistantTitle}>
            <Sparkles aria-hidden="true" className="icon" /> AI reply assistant
          </h3>
          {isStreaming ? (
            <button type="button" className="btn" onClick={suggestion.stop}>
              Stop
            </button>
          ) : (
            <button type="button" className="btn" onClick={suggestion.start}>
              {state.status === 'idle' ? 'Suggest reply' : 'Regenerate'}
            </button>
          )}
        </div>
        {state.status !== 'idle' && (
          <div className={styles.suggestion}>
            {/* aria-live announces the finished draft without reading every token. */}
            <p
              className={styles.suggestionText}
              aria-live="polite"
              aria-busy={isStreaming}
              data-testid="suggestion-text"
            >
              {suggestionText}
              {isStreaming && <span className={styles.cursor} aria-hidden="true" />}
            </p>
            {state.status === 'error' && (
              <p role="alert" className="field-error">
                {state.error}
              </p>
            )}
            {state.status === 'done' && (
              <div className={styles.suggestionActions}>
                <span className={styles.model}>Drafted by {state.model}. Review before sending.</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setDraft(state.text)
                    setFromAi(true)
                  }}
                >
                  Use this draft
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <form action={formAction} className={styles.replyForm}>
        <label htmlFor="reply-body" className="visually-hidden">
          Reply
        </label>
        <textarea
          id="reply-body"
          name="body"
          className="textarea"
          placeholder="Write a reply…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className={styles.replyActions}>
          {sendState.status === 'error' && (
            <span role="alert" className="field-error">
              {sendState.message}
            </span>
          )}
          {sendState.status === 'sent' && (
            <output className={styles.sent}>Sent</output>
          )}
          <button type="submit" className="btn btn-primary" disabled={isSending}>
            <Send aria-hidden="true" />
            {isSending ? 'Sending…' : 'Send reply'}
          </button>
        </div>
      </form>
    </div>
  )
}
