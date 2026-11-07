import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  Building2,
  CalendarClock,
  DoorOpen,
  Inbox,
  MessageSquareReply,
  Percent,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { useGetLeadsQuery } from '@/features/leads'
import { useGetVisitsQuery } from '@/features/visits'
import { LEAD_STATUSES } from '@/shared/api/types'
import { formatPercent, formatRelative, LEAD_STATUS_LABEL } from '@/shared/lib/format'
import { Skeleton } from '@/shared/ui/Skeleton'
import { EmptyState, ErrorState } from '@/shared/ui/StateViews'
import { useGetDashboardQuery } from './dashboardApi'
import styles from './DashboardPage.module.css'

const UPCOMING_DAYS = 7
const LIST_LIMIT = 5

function upcomingRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + UPCOMING_DAYS)
  return { start: start.toISOString(), end: end.toISOString() }
}

const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const timeLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

function relativeDay(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return dayLabel.format(date)
}

interface Stat {
  label: string
  value: string | number
  hint: string
  icon: LucideIcon
  tone: string
}

function StatCard({ stat }: { stat: Stat }) {
  const Icon = stat.icon
  return (
    <li className={`card ${styles.stat}`} style={{ '--tone': stat.tone } as React.CSSProperties}>
      <span className={styles.statIcon} aria-hidden="true">
        <Icon />
      </span>
      <span className={styles.statLabel}>{stat.label}</span>
      <span className={styles.statValue}>{stat.value}</span>
      <span className={styles.statHint}>{stat.hint}</span>
    </li>
  )
}

function UpcomingTours() {
  const [range] = useState(upcomingRange)
  const { data, isLoading, isError, refetch } = useGetVisitsQuery(range)
  const visits = data?.filter((visit) => visit.status === 'scheduled').slice(0, LIST_LIMIT)

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="upcoming-title">
      <header className={styles.panelHeader}>
        <h2 id="upcoming-title" className={styles.panelTitle}>
          <CalendarClock aria-hidden="true" className="icon" /> Upcoming tours
        </h2>
        <Link to="/visits" className={styles.panelLink}>
          Open agenda <ArrowRight aria-hidden="true" className="icon" />
        </Link>
      </header>
      {isLoading ? (
        <Skeleton lines={4} />
      ) : isError ? (
        <ErrorState message="Could not load tours." onRetry={refetch} />
      ) : !visits?.length ? (
        <EmptyState title="No tours in the next 7 days">
          <Link to="/visits" className="btn">
            Schedule a tour
          </Link>
        </EmptyState>
      ) : (
        <ul className={styles.list}>
          {visits.map((visit) => (
            <li key={visit.id}>
              <Link to={`/leads/${visit.lead_id}`} className={styles.item}>
                <span className={styles.when}>
                  <span className={styles.whenDay}>{relativeDay(visit.starts_at)}</span>
                  <time dateTime={visit.starts_at}>{timeLabel.format(new Date(visit.starts_at))}</time>
                </span>
                <span className={styles.itemMain}>
                  <span className={styles.itemTitle}>{visit.lead_name}</span>
                  <span className={styles.itemMeta}>
                    {visit.property_name} · {visit.unit_label}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AwaitingReply() {
  const { data, isLoading, isError, refetch } = useGetLeadsQuery({ status: 'new', search: '' })
  const leads = data?.slice(0, LIST_LIMIT)

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="awaiting-title">
      <header className={styles.panelHeader}>
        <h2 id="awaiting-title" className={styles.panelTitle}>
          <Inbox aria-hidden="true" className="icon" /> Waiting for a reply
          {data && <span className={styles.counter}>{data.length}</span>}
        </h2>
        <Link to="/leads?status=new" className={styles.panelLink}>
          View all <ArrowRight aria-hidden="true" className="icon" />
        </Link>
      </header>
      {isLoading ? (
        <Skeleton lines={4} />
      ) : isError ? (
        <ErrorState message="Could not load leads." onRetry={refetch} />
      ) : !leads?.length ? (
        <EmptyState title="Inbox zero">Every new lead has an answer.</EmptyState>
      ) : (
        <ul className={styles.list}>
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link to={`/leads/${lead.id}?status=new`} className={styles.item}>
                <span className={styles.avatar} aria-hidden="true">
                  {lead.full_name.charAt(0)}
                </span>
                <span className={styles.itemMain}>
                  <span className={styles.itemTitle}>{lead.full_name}</span>
                  <span className={styles.itemMeta}>{lead.last_message_preview}</span>
                </span>
                <time dateTime={lead.last_activity_at} className={styles.itemTime}>
                  {formatRelative(lead.last_activity_at)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <ul className={styles.stats}>
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className={`card ${styles.stat}`}>
            <Skeleton lines={3} />
          </li>
        ))}
      </ul>
      <div className={`card ${styles.funnel}`}>
        <Skeleton lines={6} />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useGetDashboardQuery()

  const header = (
    <div className="page-header">
      <div>
        <h1 id="dashboard-title">Dashboard</h1>
        <p>Portfolio health and leasing funnel at a glance.</p>
      </div>
      <Link to="/leads?status=new" className="btn btn-primary">
        <MessageSquareReply aria-hidden="true" />
        Reply to new leads
      </Link>
    </div>
  )

  let body
  if (isLoading) body = <DashboardSkeleton />
  else if (isError || !data) body = <ErrorState message="Could not load metrics." onRetry={refetch} />
  else {
    const counts = data.leads_by_status
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
    const max = Math.max(1, ...Object.values(counts))
    const occupied = data.total_units - data.vacant_units
    const stats: Stat[] = [
      {
        label: 'Occupancy',
        value: formatPercent(data.occupancy_rate),
        hint: `${occupied} of ${data.total_units} units leased`,
        icon: Building2,
        tone: 'var(--stage-won)',
      },
      {
        label: 'Vacant units',
        value: data.vacant_units,
        hint: 'Ready to lease',
        icon: DoorOpen,
        tone: 'var(--stage-applied)',
      },
      {
        label: 'Open leads',
        value: counts.new + counts.contacted,
        hint: `${counts.new} new · ${counts.contacted} contacted`,
        icon: Inbox,
        tone: 'var(--stage-new)',
      },
      {
        label: 'Lead conversion',
        value: formatPercent(data.conversion_rate),
        hint: `${counts.won} won of ${total} leads`,
        icon: Percent,
        tone: 'var(--stage-tour)',
      },
    ]

    body = (
      <>
        <ul className={styles.stats}>
          {stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </ul>
        <section className={`card ${styles.funnel}`} aria-labelledby="funnel-title">
          <header className={styles.panelHeader}>
            <h2 id="funnel-title" className={styles.panelTitle}>
              <TrendingUp aria-hidden="true" className="icon" /> Leads by stage
            </h2>
            <span className={styles.panelNote}>{total} leads in the pipeline</span>
          </header>
          <ul className={styles.bars}>
            {LEAD_STATUSES.map((status) => {
              const count = counts[status]
              return (
                <li key={status} className={styles.bar}>
                  <Link to={`/leads?status=${status}`} className={styles.barLabel}>
                    {LEAD_STATUS_LABEL[status]}
                  </Link>
                  <span className={styles.track} aria-hidden="true">
                    <span
                      className={`${styles.fill} ${styles[status]}`}
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </span>
                  <span className={styles.barValue}>
                    {count}
                    <span className={styles.barShare}>{formatPercent(total ? count / total : 0)}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </>
    )
  }

  return (
    <section aria-labelledby="dashboard-title">
      {header}
      {body}
      <div className={styles.panels}>
        <AwaitingReply />
        <UpcomingTours />
      </div>
    </section>
  )
}
