import { Link, useParams } from 'react-router'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorState } from '@/shared/ui/StateViews'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { formatCurrency, formatPercent } from '@/shared/lib/format'
import { AddUnitForm } from './AddUnitForm'
import { useGetPropertyQuery } from './propertiesApi'
import styles from './PropertyDetailPage.module.css'

export default function PropertyDetailPage() {
  const propertyId = Number(useParams().propertyId)
  const { data, isLoading, isError, refetch } = useGetPropertyQuery(propertyId)

  if (isLoading) return <Spinner label="Loading property" />
  if (isError || !data) return <ErrorState message="Property not found." onRetry={refetch} />

  return (
    <section aria-labelledby="property-title">
      <Link to="/properties" className={styles.back}>
        ← All properties
      </Link>
      <div className="page-header">
        <div>
          <h1 id="property-title">{data.name}</h1>
          <p>
            {data.address}, {data.city}, {data.state} · {data.unit_count} units ·{' '}
            {formatPercent(data.occupancy_rate)} occupied
          </p>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={`card ${styles.tableWrap}`}>
          <table className={styles.table}>
            <caption className="visually-hidden">Units at {data.name}</caption>
            <thead>
              <tr>
                <th scope="col">Unit</th>
                <th scope="col">Beds / Baths</th>
                <th scope="col">Sq ft</th>
                <th scope="col">Rent</th>
                <th scope="col">Status</th>
                <th scope="col">Available</th>
              </tr>
            </thead>
            <tbody>
              {data.units.map((unit) => (
                <tr key={unit.id}>
                  <th scope="row">{unit.label}</th>
                  <td>
                    {unit.bedrooms === 0 ? 'Studio' : `${unit.bedrooms} bd`} /{' '}
                    {Number(unit.bathrooms)} ba
                  </td>
                  <td>{unit.square_feet.toLocaleString()}</td>
                  <td>{formatCurrency(unit.rent)}</td>
                  <td>
                    <StatusBadge kind="unit" status={unit.status} />
                  </td>
                  <td>{unit.available_from ?? '—'}</td>
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
