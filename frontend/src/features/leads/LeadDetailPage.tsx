import { Link, useParams } from 'react-router'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorState } from '@/shared/ui/StateViews'
import { formatCurrency, LEAD_SOURCE_LABEL } from '@/shared/lib/format'
import { useGetLeadQuery } from './leadsApi'
import styles from './LeadDetailPage.module.css'
import { LeadStatusSelect } from './LeadStatusSelect'
import { ReplyComposer } from './ReplyComposer'

export default function LeadDetailPage() {
  const leadId = Number(useParams().leadId)
  const { data: lead, isLoading, isError, refetch } = useGetLeadQuery(leadId)

  if (isLoading) return <Spinner label="Loading lead" />
  if (isError || !lead) return <ErrorState message="Lead not found." onRetry={refetch} />

  return (
    <article className={`card ${styles.detail}`} aria-labelledby="lead-title">
      <header className={styles.header}>
        <Link to="/leads" className={styles.back}>
          ← Inbox
        </Link>
        <div className={styles.headerMain}>
          <div>
            <h2 id="lead-title" className={styles.title}>
              {lead.full_name}
            </h2>
            <p className={styles.meta}>
              <a href={`mailto:${lead.email}`}>{lead.email}</a>
              {lead.phone && <> · {lead.phone}</>} · via {LEAD_SOURCE_LABEL[lead.source]}
            </p>
          </div>
          <div className={styles.headerActions}>
            <LeadStatusSelect key={lead.id} leadId={lead.id} status={lead.status} />
            <Link to={`/visits?schedule=1&lead=${lead.id}`} className="btn">
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
              <dd>{lead.desired_move_in}</dd>
            </div>
          )}
        </dl>
      </header>

      <ol className={styles.thread} aria-label="Conversation" role="log">
        {lead.messages.map((message) => (
          <li
            key={message.id}
            className={message.direction === 'inbound' ? styles.inbound : styles.outbound}
          >
            <p className={styles.bubble}>{message.body}</p>
            <span className={styles.bubbleMeta}>
              {message.direction === 'inbound' ? lead.full_name.split(' ')[0] : 'You'}
              {message.ai_generated && ' · AI-assisted'} ·{' '}
              <time dateTime={message.created_at}>
                {new Date(message.created_at).toLocaleString()}
              </time>
            </span>
          </li>
        ))}
      </ol>

      <ReplyComposer key={lead.id} leadId={lead.id} />
    </article>
  )
}
