import { useOptimistic, useState, useTransition } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarPlus, CalendarSearch, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useGetLeadQuery } from '@/features/leads'
import type { Visit } from '@/shared/api/types'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorState } from '@/shared/ui/StateViews'
import { Loading, SkeletonBlock } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/toastContext'
import {
  addDays,
  DAY_END_HOUR,
  formatDay,
  SLOT_MINUTES,
  formatTime,
  formatTimeRange,
  fromDateKey,
  isDateKey,
  startOfWeek,
  toDateKey,
} from './dates'
import styles from './AgendaPage.module.css'
import { ScheduleVisitForm } from './ScheduleVisitForm'
import { useGetVisitsQuery, useUpdateVisitStatusMutation } from './visitsApi'

type OptimisticChange = { type: 'add'; visit: Visit } | { type: 'cancel'; id: number }

function applyChange(visits: Visit[], change: OptimisticChange): Visit[] {
  if (change.type === 'cancel') return visits.filter((visit) => visit.id !== change.id)
  return [...visits, change.visit].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
}

/** Week agenda of tours. Week, the open form and the pre-selected lead live in the URL. */
export default function AgendaPage() {
  const [params, setParams] = useSearchParams()
  const [now] = useState(() => new Date())
  const weekParam = params.get('week')
  const weekStart = startOfWeek(isDateKey(weekParam) ? fromDateKey(weekParam) : now)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const range = { start: weekStart.toISOString(), end: addDays(weekStart, 7).toISOString() }

  const { data = [], isLoading, isError, refetch, isFetching } = useGetVisitsQuery(range)
  const [visits, applyOptimistic] = useOptimistic(data, applyChange)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [updateStatus] = useUpdateVisitStatusMutation()
  const notify = useToast()

  const scheduling = params.get('schedule') === '1'
  const leadParam = Number(params.get('lead')) || null

  const updateParams = (patch: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key)
        else next.set(key, value)
      }
      return next
    })

  function cancel(visit: Visit) {
    setCancelError(null)
    startTransition(async () => {
      applyOptimistic({ type: 'cancel', id: visit.id })
      try {
        await updateStatus({ id: visit.id, status: 'canceled' }).unwrap()
        notify(`Tour with ${visit.lead_name} canceled`)
      } catch {
        setCancelError(`Could not cancel the tour with ${visit.lead_name}. It's back on the agenda.`)
      }
    })
  }

  const today = toDateKey(now)
  // Book today while there's still a slot left, otherwise tomorrow; never before the shown week.
  const lastSlot = new Date(now)
  lastSlot.setHours(DAY_END_HOUR, -SLOT_MINUTES, 0, 0)
  const firstBookable = toDateKey(now < lastSlot ? now : addDays(now, 1))
  const defaultDate =
    firstBookable >= toDateKey(weekStart) ? firstBookable : toDateKey(weekStart)

  return (
    <section aria-labelledby="agenda-title">
      <header className={`page-header ${styles.header}`}>
        <div>
          <h1 id="agenda-title">Agenda</h1>
          <p className={styles.muted}>
            Week of {formatDay(weekStart)} · {visits.length} {visits.length === 1 ? 'tour' : 'tours'}
          </p>
        </div>
        <div className={styles.toolbar}>
          <button
            type="button"
            className="btn"
            aria-label="Previous week"
            onClick={() => updateParams({ week: toDateKey(addDays(weekStart, -7)) })}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" className="btn" onClick={() => updateParams({ week: null })}>
            This week
          </button>
          <button
            type="button"
            className="btn"
            aria-label="Next week"
            onClick={() => updateParams({ week: toDateKey(addDays(weekStart, 7)) })}
          >
            <ChevronRight aria-hidden="true" />
          </button>
          {!scheduling && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => updateParams({ schedule: '1' })}
            >
              <CalendarPlus aria-hidden="true" />
              Schedule tour
            </button>
          )}
        </div>
      </header>

      {cancelError && (
        <p role="alert" className={`field-error ${styles.banner}`}>
          {cancelError}
        </p>
      )}

      <div className={styles.layout} data-form-open={scheduling}>
        {scheduling && (
          <SchedulePanel
            key={leadParam ?? 'none'}
            leadId={leadParam}
            defaultDate={defaultDate}
            onOptimisticAdd={(visit) => applyOptimistic({ type: 'add', visit })}
            onScheduled={(visit) => {
              notify(`Tour booked with ${visit.lead_name}`)
              updateParams({
                schedule: null,
                lead: null,
                week: toDateKey(startOfWeek(new Date(visit.starts_at))),
              })
            }}
            onClose={() => updateParams({ schedule: null, lead: null })}
          />
        )}

        {isLoading ? (
          <Loading label="Loading agenda">
            <SkeletonBlock height="9rem" />
          </Loading>
        ) : isError ? (
          <ErrorState message="Could not load the agenda." onRetry={refetch} />
        ) : (
          <div className={styles.weekWrap}>
            {visits.length === 0 && !isFetching && (
              <NextTourHint
                after={addDays(weekStart, 7)}
                onJump={(date) => updateParams({ week: toDateKey(startOfWeek(date)) })}
              />
            )}
            <ol className={styles.week} aria-label="Week" aria-busy={isFetching}>
              {days.map((day) => {
                const key = toDateKey(day)
                const dayVisits = visits.filter((visit) => toDateKey(new Date(visit.starts_at)) === key)
                return (
                  <li
                    key={key}
                    className={styles.day}
                    data-today={key === today}
                    data-past={key < today}
                  >
                    <h2 className={styles.dayTitle}>
                      <time dateTime={key}>{formatDay(day)}</time>
                      {key === today && <span className={styles.todayPill}>Today</span>}
                    </h2>
                    {dayVisits.length === 0 ? (
                      <p className={styles.empty}>No tours</p>
                    ) : (
                      <ul className={styles.visits} aria-label={`Tours on ${formatDay(day)}`}>
                        {dayVisits.map((visit) => (
                          <VisitCard key={visit.id} visit={visit} onCancel={cancel} />
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}

function VisitCard({ visit, onCancel }: { visit: Visit; onCancel: (visit: Visit) => void }) {
  const pending = visit.id < 0
  return (
    <li className={styles.visit} data-pending={pending} aria-busy={pending}>
      <span className={styles.time}>{formatTimeRange(visit.starts_at, visit.ends_at)}</span>
      <Link to={`/leads/${visit.lead_id}`} className={styles.lead}>
        {visit.lead_name}
      </Link>
      <span className={styles.muted}>
        {visit.property_name} · {visit.unit_label}
      </span>
      {visit.agent_name && <span className={styles.muted}>with {visit.agent_name}</span>}
      {visit.notes && <span className={styles.notes}>{visit.notes}</span>}
      {pending ? (
        <span className={styles.muted}>Booking…</span>
      ) : (
        <button
          type="button"
          className={`btn btn-ghost ${styles.cancel}`}
          onClick={() => onCancel(visit)}
          aria-label={`Cancel tour with ${visit.lead_name} at ${formatTime(visit.starts_at)}`}
          title="Cancel tour"
        >
          <X aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

const LOOKAHEAD_DAYS = 60

/** On an empty week, point to the next booked tour instead of seven blank columns. */
function NextTourHint({ after, onJump }: { after: Date; onJump: (date: Date) => void }) {
  const range = { start: after.toISOString(), end: addDays(after, LOOKAHEAD_DAYS).toISOString() }
  const { data } = useGetVisitsQuery(range)
  const next = data?.find((visit) => visit.status === 'scheduled')

  return (
    <div className={styles.hint}>
      <CalendarSearch aria-hidden="true" className={styles.hintIcon} />
      <p>
        <strong>No tours this week.</strong>{' '}
        {next
          ? `The next one is with ${next.lead_name} on ${formatDay(new Date(next.starts_at))}.`
          : 'Book one from a lead or with Schedule tour.'}
      </p>
      {next && (
        <button type="button" className="btn" onClick={() => onJump(new Date(next.starts_at))}>
          Go to that week
        </button>
      )}
    </div>
  )
}

type PanelProps = Omit<Parameters<typeof ScheduleVisitForm>[0], 'initialLead'> & {
  leadId: number | null
}

/** Loads the lead from `?lead=` (e.g. coming from the lead page) before mounting the form. */
function SchedulePanel({ leadId, ...props }: PanelProps) {
  const lead = useGetLeadQuery(leadId ?? 0, { skip: leadId === null })
  if (leadId !== null && lead.isLoading) return <Spinner label="Loading lead" />
  const initialLead = lead.data
    ? {
        id: lead.data.id,
        name: lead.data.full_name,
        unitId: lead.data.unit?.id ?? null,
        unitLabel: lead.data.unit?.label ?? null,
        propertyName: lead.data.unit?.property_name ?? null,
      }
    : null
  return <ScheduleVisitForm initialLead={initialLead} {...props} />
}
