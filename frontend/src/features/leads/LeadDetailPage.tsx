import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft, CalendarPlus, Mail, Megaphone, Phone, Sparkles } from 'lucide-react'
import type { Message } from '@/shared/api/types'
import { Loading, Skeleton, SkeletonBlock } from '@/shared/ui/Skeleton'
import { ErrorState } from '@/shared/ui/StateViews'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDayHeading,
  formatTime,
  leadSourceLabel,
} from '@/shared/lib/format'
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

export default function LeadDetailPage() {
  const { t } = useTranslation('leads')
  const leadId = Number(useParams().leadId)
  const { data: lead, isLoading, isError, refetch } = useGetLeadQuery(leadId)

  if (isLoading)
    return (
      <Loading label={t('detail.loading')}>
        <div className={`card ${styles.loading}`}>
          <Skeleton lines={2} />
          <SkeletonBlock height="16rem" />
          <SkeletonBlock height="6rem" />
        </div>
      </Loading>
    )
  if (isError || !lead) return <ErrorState message={t('detail.notFound')} onRetry={refetch} />

  return (
    <article className={`card ${styles.detail}`} aria-labelledby="lead-title">
      <header className={styles.header}>
        <Link to="/leads" className={styles.back}>
          <ArrowLeft aria-hidden="true" className="icon" /> {t('detail.back')}
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
                  {t('detail.via', { source: leadSourceLabel(lead.source) })}
                </li>
              </ul>
            </div>
          </div>
          <div className={styles.headerActions}>
            <LeadStatusSelect key={lead.id} leadId={lead.id} status={lead.status} />
            <Link to={`/visits?schedule=1&lead=${lead.id}`} className="btn">
              <CalendarPlus aria-hidden="true" />
              {t('detail.schedule')}
            </Link>
          </div>
        </div>
        <dl className={styles.facts}>
          {lead.unit && (
            <div>
              <dt>{t('detail.interested')}</dt>
              <dd>
                <Link to={`/properties/${lead.unit.property_id}`}>{lead.unit.property_name}</Link>{' '}
                · {lead.unit.label} · {t('detail.perMonth', { amount: formatCurrency(lead.unit.rent) })}
              </dd>
            </div>
          )}
          {lead.budget && (
            <div>
              <dt>{t('detail.budget')}</dt>
              <dd>{t('detail.perMonth', { amount: formatCurrency(lead.budget) })}</dd>
            </div>
          )}
          {lead.desired_move_in && (
            <div>
              <dt>{t('detail.moveIn')}</dt>
              <dd>
                <time dateTime={lead.desired_move_in}>
                  {formatDate(lead.desired_move_in)}
                </time>
              </dd>
            </div>
          )}
        </dl>
      </header>

      <ol className={styles.thread} aria-label={t('detail.conversation')} role="log">
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
                  {message.direction === 'inbound' ? lead.full_name.split(' ')[0] : t('detail.you')}
                  {message.ai_generated && (
                    <span className={styles.aiTag}>
                      <Sparkles aria-hidden="true" /> {t('detail.aiAssisted')}
                    </span>
                  )}
                  <time dateTime={message.created_at} title={formatDateTime(message.created_at)}>
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
