import { useActionState, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('leads')
  const [draft, setDraft] = useState('')
  const [fromAi, setFromAi] = useState(false)
  const [sendMessage] = useSendMessageMutation()
  const suggestion = useReplySuggestion(leadId)
  const notify = useToast()
  const { state } = suggestion

  const [sendState, formAction, isSending] = useActionState<SendState, FormData>(
    async (_previous, formData) => {
      const body = String(formData.get('body') ?? '').trim()
      if (!body) return { status: 'error', message: t('composer.empty') }
      try {
        await sendMessage({ leadId, body, aiGenerated: fromAi }).unwrap()
        setDraft('')
        setFromAi(false)
        suggestion.reset()
        notify(t('composer.sentToast'))
        return { status: 'sent' }
      } catch {
        return { status: 'error', message: t('composer.sendError') }
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
            <Sparkles aria-hidden="true" className="icon" /> {t('composer.assistant')}
          </h3>
          {isStreaming ? (
            <button type="button" className="btn" onClick={suggestion.stop}>
              {t('composer.stop')}
            </button>
          ) : (
            <button type="button" className="btn" onClick={suggestion.start}>
              {state.status === 'idle' ? t('composer.suggest') : t('composer.regenerate')}
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
                <span className={styles.model}>{t('composer.draftedBy', { model: state.model })}</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setDraft(state.text)
                    setFromAi(true)
                  }}
                >
                  {t('composer.useDraft')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <form action={formAction} className={styles.replyForm}>
        <label htmlFor="reply-body" className="visually-hidden">
          {t('composer.reply')}
        </label>
        <textarea
          id="reply-body"
          name="body"
          className="textarea"
          placeholder={t('composer.placeholder')}
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
            <output className={styles.sent}>{t('composer.sent')}</output>
          )}
          <button type="submit" className="btn btn-primary" disabled={isSending}>
            <Send aria-hidden="true" />
            {isSending ? t('composer.sending') : t('composer.send')}
          </button>
        </div>
      </form>
    </div>
  )
}
