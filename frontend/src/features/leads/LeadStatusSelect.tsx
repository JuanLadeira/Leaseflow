import { useOptimistic, useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { LEAD_STATUSES, type LeadStatus } from '@/shared/api/types'
import { leadStatusLabel } from '@/shared/lib/format'
import { useToast } from '@/shared/ui/toastContext'
import { useUpdateLeadStatusMutation } from './leadsApi'

/**
 * React 19 `useOptimistic`: the select shows the new status immediately while
 * the PATCH is in flight. When the transition ends React drops the optimistic
 * value and shows the server value: the new one on success, the old one on failure.
 */
export function LeadStatusSelect({ leadId, status }: { leadId: number; status: LeadStatus }) {
  const { t } = useTranslation('leads')
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [updateStatus] = useUpdateLeadStatusMutation()
  const notify = useToast()

  function onChange(next: LeadStatus) {
    setError(null)
    startTransition(async () => {
      setOptimisticStatus(next)
      try {
        await updateStatus({ id: leadId, status: next }).unwrap()
        notify(t('status.moved', { status: leadStatusLabel(next) }))
      } catch {
        setError(t('status.error'))
      }
    })
  }

  return (
    <div className="field">
      <label htmlFor="lead-status">{t('status.label')}</label>
      <select
        id="lead-status"
        className="select"
        value={optimisticStatus}
        aria-busy={isPending}
        onChange={(event) => onChange(event.target.value as LeadStatus)}
      >
        {LEAD_STATUSES.map((value) => (
          <option key={value} value={value}>
            {leadStatusLabel(value)}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="field-error">
          {error}
        </span>
      )}
    </div>
  )
}
