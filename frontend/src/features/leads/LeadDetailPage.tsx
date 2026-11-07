import { Fragment } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, CalendarPlus, Mail, Megaphone, Phone, Sparkles } from 'lucide-react'
import type { Message } from '@/shared/api/types'
import { Loading, Skeleton, SkeletonBlock } from '@/shared/ui/Skeleton'
import { ErrorState } from '@/shared/ui/StateViews'
import { formatCurrency, formatDayHeading, formatTime, LEAD_SOURCE_LABEL } from '@/shared/lib/format'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { useGetLeadQuery } from './leadsApi'
import styles from './LeadDetailPage.module.css'
import { LeadStatusSelect } from './LeadStatusSelect'
import { ReplyComposer } from './ReplyComposer'

/** Group a conversation by calendar day so the thread reads like a chat app. */
function byDay(messages: Message[]) {
  const groups: { day: string; label: string; messages: Message[] }[] = []
  for (const message of messages) {
    const day = new Date(message.created_at).toDateString()
    const last = groups.at(-1)
    if (last?.day === day) last.messages.push(message)
    else groups.push({ day, label: formatDayHeading(message.created_at), messages: [message] })
  }
  return groups
}

const moveIn = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function LeadDetailPage() {
  const leadId = Number(useParams().leadId)
  const { data: lead, isLoading, isError, refetch } = useGetLeadQuery(leadId)

  if (isLoading)
    return (
      <Loading label="Loading lead">
        <div className={`card ${styles.loading}`}>
          <Skeleton lines={2} />
          <SkeletonBlock height="16rem" />
          <SkeletonBlock height="6rem" />
        </div>
      </Loading>
    )
  if (isError || !lead) return <ErrorState message="Lead not found." onRetry={refetch} />

  return (
    <article className={`card ${styles.detail}`} aria-labelledby="lead-title">
      <header className={styles.header}>
        <Link to="/leads" className={styles.back}>
          <ArrowLeft aria-hidden="true" className="icon" /> Inbox
        </Link>
        <div className={styles.headerMain}>
          <div className={styles.identity}>
            <span className={styles.avatar} aria-hidden="true">
              {lead.full_name.charAt(0)}
            </span>
            <div className={styles.identityText}>
              <div className={styles.titleRow}>
                <h2 id="lead-title" className={styles.title}>
                  {lead.full_name}
                </h2>
                <StatusBadge kind="lead" status={lead.status} />
              </div>
              <ul className={styles.meta}>
                <li>
                  <Mail aria-hidden="true" className="icon" />
                  <a href={`mailto:${lead.email}`}>{lead.email}</a>
                </li>
                {lead.phone && (
                  <li>
                    <Phone aria-hidden="true" className="icon" />
                    {lead.phone}
                  </li>
                )}
                <li>
                  <Megaphone aria-hidden="true" className="icon" />
                  via {LEAD_SOURCE_LABEL[lead.source]}
                </li>
              </ul>
            </div>
          </div>
          <div className={styles.headerActions}>
            <LeadStatusSelect key={lead.id} leadId={lead.id} status={lead.status} />
            <Link to={`/visits?schedule=1&lead=${lead.id}`} className="btn">
              <CalendarPlus aria-hidden="true" />
              Schedule tour
            </Link>
          </div>
        </div>
        <dl className={styles.facts}>
          {lead.unit && (
            <div>
              <dt>Interested in</dt>
              <dd>
                <Link to={`/properties/${lead.unit.property_id}`}>{lead.unit.property_name}</Link>{' '}
                · {lead.unit.label} · {formatCurrency(lead.unit.rent)}/mo
              </dd>
            </div>
          )}
          {lead.budget && (
            <div>
              <dt>Budget</dt>
              <dd>{formatCurrency(lead.budget)}/mo</dd>
            </div>
          )}
          {lead.desired_move_in && (
            <div>
              <dt>Move-in</dt>
              <dd>
                <time dateTime={lead.desired_move_in}>
                  {moveIn.format(new Date(`${lead.desired_move_in}T00:00`))}
                </time>
              </dd>
            </div>
          )}
        </dl>
      </header>

      <ol className={styles.thread} aria-label="Conversation" role="log">
        {byDay(lead.messages).map((group) => (
          <Fragment key={group.day}>
            <li className={styles.daySeparator} aria-hidden="true">
              <span>{group.label}</span>
            </li>
            {group.messages.map((message) => (
              <li
                key={message.id}
                className={message.direction === 'inbound' ? styles.inbound : styles.outbound}
              >
                <p className={styles.bubble}>{message.body}</p>
                <span className={styles.bubbleMeta}>
                  {message.direction === 'inbound' ? lead.full_name.split(' ')[0] : 'You'}
                  {message.ai_generated && (
                    <span className={styles.aiTag}>
                      <Sparkles aria-hidden="true" /> AI-assisted
                    </span>
                  )}
                  <time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString()}>
                    {formatTime(message.created_at)}
                  </time>
                </span>
              </li>
            ))}
          </Fragment>
        ))}
      </ol>

      <ReplyComposer key={lead.id} leadId={lead.id} />
    </article>
  )
}
