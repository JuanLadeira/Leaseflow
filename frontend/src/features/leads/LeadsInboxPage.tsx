import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useParams, useSearchParams } from 'react-router'
import { LEAD_STATUSES, type LeadListItem, type LeadStatus } from '@/shared/api/types'
import { Loading, Skeleton } from '@/shared/ui/Skeleton'
import { EmptyState, ErrorState } from '@/shared/ui/StateViews'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { VirtualList } from '@/shared/ui/VirtualList'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatRelative, leadStatusLabel } from '@/shared/lib/format'
import { useGetLeadsQuery } from './leadsApi'
import styles from './LeadsInboxPage.module.css'

const ROW_HEIGHT = 104

function isLeadStatus(value: string | null): value is LeadStatus {
  return LEAD_STATUSES.includes(value as LeadStatus)
}

function LeadRow({ lead, search }: { lead: LeadListItem; search: string }) {
  return (
    <NavLink
      // keep the current filters in the URL when opening a lead
      to={{ pathname: `/leads/${lead.id}`, search }}
      className={({ isActive }) => (isActive ? `${styles.row} ${styles.rowActive}` : styles.row)}
    >
      <span className={styles.rowTop}>
        <span className={styles.name}>{lead.full_name}</span>
        <time dateTime={lead.last_activity_at} className={styles.time}>
          {formatRelative(lead.last_activity_at)}
        </time>
      </span>
      <span className={styles.rowMeta}>
        <StatusBadge kind="lead" status={lead.status} />
        {lead.property_name && (
          <span className={styles.unit}>
            {lead.property_name} · {lead.unit_label}
          </span>
        )}
      </span>
      <span className={styles.preview}>{lead.last_message_preview}</span>
    </NavLink>
  )
}

export default function LeadsInboxPage() {
  const { t } = useTranslation('leads')
  // Filters live in the URL: shareable, survive reloads and back/forward navigation.
  const [searchParams, setSearchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const statusFilter: LeadStatus | 'all' = isLeadStatus(statusParam) ? statusParam : 'all'
  const search = searchParams.get('q') ?? ''
  const debouncedSearch = useDebounce(search, 300)

  function updateParams(changes: Record<string, string | null>) {
    setSearchParams(
      (params) => {
        for (const [key, value] of Object.entries(changes)) {
          if (value) params.set(key, value)
          else params.delete(key)
        }
        return params
      },
      { replace: true },
    )
  }
  const { leadId } = useParams()

  const { data, isLoading, isError, refetch } = useGetLeadsQuery({
    status: statusFilter,
    search: debouncedSearch,
  })

  return (
    <div className={styles.inbox} data-detail-open={leadId ? 'true' : 'false'}>
      <section className={`card ${styles.listPane}`} aria-labelledby="inbox-title">
        <div className={styles.toolbar}>
          <h1 id="inbox-title" className={styles.title}>
            {t('inbox.title')} {data && <span className={styles.count}>({data.length})</span>}
          </h1>
          <label htmlFor="lead-search" className="visually-hidden">
            {t('inbox.search')}
          </label>
          <input
            id="lead-search"
            type="search"
            className="input"
            placeholder={t('inbox.searchPlaceholder')}
            value={search}
            onChange={(event) => updateParams({ q: event.target.value })}
          />
          <fieldset className={styles.filters}>
            <legend className="visually-hidden">{t('inbox.filter')}</legend>
            {(['all', ...LEAD_STATUSES] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={styles.chip}
                aria-pressed={statusFilter === status}
                onClick={() => updateParams({ status: status === 'all' ? null : status })}
              >
                {status === 'all' ? t('inbox.all') : leadStatusLabel(status)}
              </button>
            ))}
          </fieldset>
        </div>
        <div className={styles.listBody}>
          {isLoading ? (
            <Loading label={t('inbox.loading')}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className={styles.row} style={{ height: ROW_HEIGHT }}>
                  <Skeleton lines={3} />
                </div>
              ))}
            </Loading>
          ) : isError ? (
            <ErrorState message={t('inbox.error')} onRetry={refetch} />
          ) : !data?.length ? (
            <EmptyState title={t('inbox.empty')} />
          ) : (
            <VirtualList
              aria-label={t('inbox.list')}
              items={data}
              rowHeight={ROW_HEIGHT}
              getKey={(lead) => lead.id}
              renderItem={(lead) => <LeadRow lead={lead} search={searchParams.toString()} />}
            />
          )}
        </div>
      </section>
      <section className={styles.detailPane} aria-label={t('inbox.detail')}>
        <Outlet />
      </section>
    </div>
  )
}

export function NoLeadSelected() {
  const { t } = useTranslation('leads')
  return <EmptyState title={t('inbox.noneSelected')}>{t('inbox.noneSelectedBody')}</EmptyState>
}
