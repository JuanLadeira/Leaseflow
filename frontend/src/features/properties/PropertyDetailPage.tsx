import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorState } from '@/shared/ui/StateViews'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/shared/lib/format'
import { AddUnitForm } from './AddUnitForm'
import { useGetPropertyQuery } from './propertiesApi'
import styles from './PropertyDetailPage.module.css'

export default function PropertyDetailPage() {
  const { t } = useTranslation('properties')
  const propertyId = Number(useParams().propertyId)
  const { data, isLoading, isError, refetch } = useGetPropertyQuery(propertyId)

  if (isLoading) return <Spinner label={t('detail.loading')} />
  if (isError || !data) return <ErrorState message={t('detail.notFound')} onRetry={refetch} />

  return (
    <section aria-labelledby="property-title">
      <Link to="/properties" className={styles.back}>
        {t('detail.back')}
      </Link>
      <div className="page-header">
        <div>
          <h1 id="property-title">{data.name}</h1>
          <p>
            {data.address}, {data.city}, {data.state} · {t('detail.summary', { count: data.unit_count })} ·{' '}
            {t('detail.occupied', { value: formatPercent(data.occupancy_rate) })}
          </p>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={`card ${styles.tableWrap}`}>
          <table className={styles.table}>
            <caption className="visually-hidden">{t('detail.caption', { name: data.name })}</caption>
            <thead>
              <tr>
                <th scope="col">{t('detail.unit')}</th>
                <th scope="col">{t('detail.bedsBaths')}</th>
                <th scope="col">{t('detail.sqft')}</th>
                <th scope="col">{t('detail.rent')}</th>
                <th scope="col">{t('detail.status')}</th>
                <th scope="col">{t('detail.available')}</th>
              </tr>
            </thead>
            <tbody>
              {data.units.map((unit) => (
                <tr key={unit.id}>
                  <th scope="row">{unit.label}</th>
                  <td>
                    {unit.bedrooms === 0 ? t('detail.studio') : t('detail.beds', { count: unit.bedrooms })} /{' '}
                    {t('detail.baths', { count: Number(unit.bathrooms) })}
                  </td>
                  <td>{formatNumber(unit.square_feet)}</td>
                  <td>{formatCurrency(unit.rent)}</td>
                  <td>
                    <StatusBadge kind="unit" status={unit.status} />
                  </td>
                  <td>{unit.available_from ? formatDate(unit.available_from) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddUnitForm propertyId={propertyId} />
      </div>
    </section>
  )
}
