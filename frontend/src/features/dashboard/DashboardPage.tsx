import { Link } from 'react-router'
import { LEAD_STATUSES } from '@/shared/api/types'
import { formatPercent, LEAD_STATUS_LABEL } from '@/shared/lib/format'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorState } from '@/shared/ui/StateViews'
import { useGetDashboardQuery } from './dashboardApi'
import styles from './DashboardPage.module.css'

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useGetDashboardQuery()

  if (isLoading) return <Spinner label="Loading dashboard" />
  if (isError || !data) return <ErrorState message="Could not load metrics." onRetry={refetch} />

  const max = Math.max(1, ...Object.values(data.leads_by_status))
  const stats = [
    { label: 'Occupancy', value: formatPercent(data.occupancy_rate) },
    { label: 'Vacant units', value: `${data.vacant_units} / ${data.total_units}` },
    { label: 'Open leads', value: data.leads_by_status.new + data.leads_by_status.contacted },
    { label: 'Lead conversion', value: formatPercent(data.conversion_rate) },
  ]

  return (
    <section aria-labelledby="dashboard-title">
      <div className="page-header">
        <div>
          <h1 id="dashboard-title">Dashboard</h1>
          <p>Portfolio health and leasing funnel at a glance.</p>
        </div>
        <Link to="/leads?status=new" className="btn btn-primary">
          Reply to new leads
        </Link>
      </div>
      <ul className={styles.stats}>
        {stats.map((stat) => (
          <li key={stat.label} className={`card ${styles.stat}`}>
            <span className={styles.statLabel}>{stat.label}</span>
            <span className={styles.statValue}>{stat.value}</span>
          </li>
        ))}
      </ul>
      <div className={`card ${styles.funnel}`}>
        <h2 className={styles.funnelTitle}>Leads by stage</h2>
        <ul className={styles.bars}>
          {LEAD_STATUSES.map((status) => {
            const count = data.leads_by_status[status]
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
                <span className={styles.barValue}>{count}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
