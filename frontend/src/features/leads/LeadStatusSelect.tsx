import { useOptimistic, useState, useTransition } from 'react'
import { LEAD_STATUSES, type LeadStatus } from '@/shared/api/types'
import { LEAD_STATUS_LABEL } from '@/shared/lib/format'
import { useUpdateLeadStatusMutation } from './leadsApi'

/**
 * React 19 `useOptimistic`: the select shows the new status immediately while
 * the PATCH is in flight. When the transition ends React drops the optimistic
 * value and shows the server value: the new one on success, the old one on failure.
 */
export function LeadStatusSelect({ leadId, status }: { leadId: number; status: LeadStatus }) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [updateStatus] = useUpdateLeadStatusMutation()

  function onChange(next: LeadStatus) {
    setError(null)
    startTransition(async () => {
      setOptimisticStatus(next)
      try {
        await updateStatus({ id: leadId, status: next }).unwrap()
      } catch {
        setError('Could not update the status. Reverted.')
      }
    })
  }

  return (
    <div className="field">
      <label htmlFor="lead-status">Pipeline status</label>
      <select
        id="lead-status"
        className="select"
        value={optimisticStatus}
        aria-busy={isPending}
        onChange={(event) => onChange(event.target.value as LeadStatus)}
      >
        {LEAD_STATUSES.map((value) => (
          <option key={value} value={value}>
            {LEAD_STATUS_LABEL[value]}
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
