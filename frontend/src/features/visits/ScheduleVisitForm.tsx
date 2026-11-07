import { useActionState, useReducer, useState } from 'react'
import { useGetLeadsQuery } from '@/features/leads'
import type { ApiError, Visit, VisitConflict } from '@/shared/api/types'
import { useAuth } from '@/shared/auth/AuthContext'
import { useDebounce } from '@/shared/hooks/useDebounce'
import {
  addDays,
  addMinutes,
  atTime,
  DURATIONS,
  formatTime,
  fromDateKey,
  overlaps,
  slotTimes,
  toDateKey,
  type Duration,
} from './dates'
import styles from './AgendaPage.module.css'
import { initialSchedule, scheduleReducer, type PickedLead } from './scheduleReducer'
import { useGetVisitsQuery, useScheduleVisitMutation } from './visitsApi'

type SubmitState = { status: 'idle' } | { status: 'error'; message: string }

interface Props {
  initialLead: PickedLead | null
  defaultDate: string
  /** Shows the visit in the agenda right away (parent's useOptimistic). */
  onOptimisticAdd: (visit: Visit) => void
  onScheduled: (visit: Visit) => void
  onClose: () => void
}

function errorMessage(error: unknown): { message: string; conflict: boolean } {
  const err = error as { status?: number; data?: ApiError | VisitConflict }
  if (err?.status === 409) return { message: err.data?.detail ?? 'That slot was just taken.', conflict: true }
  if (err?.status === 400 || err?.status === 404)
    return { message: err.data?.detail ?? 'Could not book this visit.', conflict: false }
  return { message: 'Could not book the visit. Try again.', conflict: false }
}

/**
 * Tour booking form.
 * - useReducer owns the interdependent fields (lead → unit, day, duration, slot),
 *   so a change that invalidates the picked slot clears it in one transition.
 * - Free slots are derived during render from that day's visits: no effect, no copy.
 * - Submit is a React 19 form action + useActionState; the action pushes an
 *   optimistic card into the agenda before the request resolves.
 */
export function ScheduleVisitForm({
  initialLead,
  defaultDate,
  onOptimisticAdd,
  onScheduled,
  onClose,
}: Props) {
  const [state, dispatch] = useReducer(scheduleReducer, undefined, () =>
    initialSchedule(defaultDate, initialLead),
  )
  const { user } = useAuth()
  // Read the clock once per mount: render stays pure, slots don't shift mid-edit.
  const [now] = useState(() => new Date())
  const [scheduleVisit] = useScheduleVisitMutation()

  const search = useDebounce(state.leadQuery.trim(), 250)
  const leadResults = useGetLeadsQuery({ search }, { skip: !search || state.lead !== null })

  const day = fromDateKey(state.date)
  const dayVisits = useGetVisitsQuery({
    start: day.toISOString(),
    end: addDays(day, 1).toISOString(),
  })

  const slots = slotTimes(state.duration).map((time) => {
    const start = atTime(state.date, time)
    const end = addMinutes(start, state.duration)
    const clash = (dayVisits.data ?? []).find(
      (visit) =>
        visit.status === 'scheduled' &&
        overlaps(start, end, new Date(visit.starts_at), new Date(visit.ends_at)) &&
        (visit.unit_id === state.lead?.unitId || (user !== null && visit.agent_id === user.id)),
    )
    const reason =
      start < now
        ? 'past'
        : clash
          ? clash.unit_id === state.lead?.unitId
            ? 'unit booked'
            : 'you are busy'
          : null
    return { time, label: formatTime(start), reason }
  })

  const [submit, formAction, isPending] = useActionState<SubmitState, FormData>(
    async (_previous, formData) => {
      const { lead, time } = state
      if (!lead) return { status: 'error', message: 'Pick a lead first.' }
      if (!lead.unitId) return { status: 'error', message: 'This lead has no unit of interest.' }
      if (!time) return { status: 'error', message: 'Pick a time slot.' }

      const start = atTime(state.date, time)
      const end = addMinutes(start, state.duration)
      const notes = String(formData.get('notes') ?? '').trim()
      onOptimisticAdd({
        id: -start.getTime(),
        lead_id: lead.id,
        lead_name: lead.name,
        unit_id: lead.unitId,
        unit_label: lead.unitLabel ?? '',
        property_id: 0,
        property_name: lead.propertyName ?? '',
        agent_id: user?.id ?? null,
        agent_name: 'You',
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: 'scheduled',
        notes,
      })
      try {
        const visit = await scheduleVisit({
          lead_id: lead.id,
          unit_id: lead.unitId,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          notes,
        }).unwrap()
        onScheduled(visit)
        return { status: 'idle' }
      } catch (error) {
        const { message, conflict } = errorMessage(error)
        if (conflict) {
          dispatch({ type: 'slotTaken' })
          dayVisits.refetch()
        }
        return { status: 'error', message }
      }
    },
    { status: 'idle' },
  )

  return (
    <form action={formAction} className={`card ${styles.form}`} aria-labelledby="schedule-title">
      <div className={styles.formHeader}>
        <h2 id="schedule-title" className={styles.formTitle}>
          Schedule a tour
        </h2>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close form">
          ✕
        </button>
      </div>

      <fieldset className={styles.fieldset}>
        <legend>Lead</legend>
        {state.lead ? (
          <div className={styles.picked}>
            <div>
              <strong>{state.lead.name}</strong>
              <span className={styles.muted}>
                {state.lead.unitLabel
                  ? `${state.lead.propertyName} · ${state.lead.unitLabel}`
                  : 'No unit of interest'}
              </span>
            </div>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'leadCleared' })}>
              Change
            </button>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="lead-search">Search leads</label>
            <input
              id="lead-search"
              className="input"
              type="search"
              autoComplete="off"
              placeholder="Name or email"
              value={state.leadQuery}
              onChange={(event) => dispatch({ type: 'leadQueryChanged', query: event.target.value })}
            />
            {search && (
              <ul className={styles.results} aria-label="Matching leads">
                {(leadResults.data ?? []).slice(0, 6).map((lead) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                      className={styles.result}
                      onClick={() =>
                        dispatch({
                          type: 'leadPicked',
                          lead: {
                            id: lead.id,
                            name: lead.full_name,
                            unitId: lead.unit_id,
                            unitLabel: lead.unit_label,
                            propertyName: lead.property_name,
                          },
                        })
                      }
                    >
                      <strong>{lead.full_name}</strong>
                      <span className={styles.muted}>
                        {lead.property_name ? `${lead.property_name} · ${lead.unit_label}` : lead.email}
                      </span>
                    </button>
                  </li>
                ))}
                {leadResults.data?.length === 0 && <li className={styles.muted}>No leads found.</li>}
              </ul>
            )}
          </div>
        )}
      </fieldset>

      <div className={styles.row}>
        <div className="field">
          <label htmlFor="visit-date">Day</label>
          <input
            id="visit-date"
            className="input"
            type="date"
            min={toDateKey(now)}
            value={state.date}
            onChange={(event) =>
              event.target.value && dispatch({ type: 'dateChanged', date: event.target.value })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="visit-duration">Duration</label>
          <select
            id="visit-duration"
            className="select"
            value={state.duration}
            onChange={(event) =>
              dispatch({ type: 'durationChanged', duration: Number(event.target.value) as Duration })
            }
          >
            {DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className={styles.fieldset} aria-busy={dayVisits.isFetching}>
        <legend>Time</legend>
        <div className={styles.slots}>
          {slots.map((slot) => (
            <button
              key={slot.time}
              type="button"
              className={styles.slot}
              aria-pressed={state.time === slot.time}
              disabled={slot.reason !== null}
              title={slot.reason ?? undefined}
              aria-label={slot.reason ? `${slot.label} (${slot.reason})` : slot.label}
              onClick={() => dispatch({ type: 'timePicked', time: slot.time })}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="visit-notes">Notes</label>
        <textarea id="visit-notes" name="notes" className="textarea" maxLength={1000} rows={2} />
      </div>

      {submit.status === 'error' && (
        <p role="alert" className="field-error">
          {submit.message}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={isPending}>
        {isPending ? 'Booking…' : 'Book tour'}
      </button>
    </form>
  )
}
