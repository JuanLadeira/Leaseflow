import type { CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Pagination } from '@/shared/ui/Pagination'
import { Loading, Skeleton, SkeletonBlock } from '@/shared/ui/Skeleton'
import { EmptyState, ErrorState } from '@/shared/ui/StateViews'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatPercent } from '@/shared/lib/format'
import { useGetPropertiesQuery } from './propertiesApi'
import styles from './PropertiesPage.module.css'

const PAGE_SIZE = 6

export default function PropertiesPage() {
  // Search and page live in the URL so results are linkable and survive reloads.
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const setPage = (next: number) =>
    setSearchParams((params) => {
      params.set('page', String(next))
      return params
    })
  const debouncedSearch = useDebounce(search, 300)

  // The query key is (search, page): RTK Query caches each combination, so going
  // back to a previous page is instant and requests are deduplicated.
  const { data, isLoading, isFetching, isError, refetch } = useGetPropertiesQuery({
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
  })

  return (
    <section aria-labelledby="properties-title">
      <div className="page-header">
        <div>
          <h1 id="properties-title">Properties</h1>
          <p>{data ? `${data.count} properties in your portfolio` : 'Your portfolio'}</p>
        </div>
        <div className={`field ${styles.search}`}>
          <label htmlFor="property-search" className="visually-hidden">
            Search properties
          </label>
          <input
            id="property-search"
            type="search"
            className="input"
            placeholder="Search by name, city or address"
            value={search}
            onChange={(event) => {
              // A new search starts from page 1: done in the event handler, not in an effect.
              const q = event.target.value
              setSearchParams(q ? { q } : {}, { replace: true })
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <Loading label="Loading properties">
          <div className={styles.grid} aria-hidden="true">
            {Array.from({ length: PAGE_SIZE }, (_, i) => (
              <div key={i} className={`card ${styles.card}`}>
                <SkeletonBlock height="4.5rem" />
                <div className={styles.body}>
                  <Skeleton lines={3} />
                </div>
              </div>
            ))}
          </div>
        </Loading>
      ) : isError ? (
        <ErrorState message="Could not load properties." onRetry={refetch} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No properties found">Try a different search term.</EmptyState>
      ) : (
        <>
          <ul className={styles.grid} aria-busy={isFetching}>
            {data.items.map((property) => (
              <li key={property.id} className={`card ${styles.card}`}>
                {property.image_url ? (
                  <img src={property.image_url} alt="" loading="lazy" className={styles.image} />
                ) : (
                  // No photo: a deterministic gradient keeps cards distinct without external assets.
                  <div
                    className={styles.image}
                    aria-hidden="true"
                    style={{ '--hue': (property.id * 47) % 360 } as CSSProperties}
                  >
                    <span className={styles.initials}>
                      {property.name
                        .split(' ')
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join('')}
                    </span>
                  </div>
                )}
                <div className={styles.body}>
                  <h2 className={styles.name}>
                    <Link to={`/properties/${property.id}`}>{property.name}</Link>
                  </h2>
                  <p className={styles.address}>
                    {property.address}, {property.city}, {property.state}
                  </p>
                  <dl className={styles.stats}>
                    <div>
                      <dt>Units</dt>
                      <dd>{property.unit_count}</dd>
                    </div>
                    <div>
                      <dt>Vacant</dt>
                      <dd>{property.vacant_count}</dd>
                    </div>
                    <div>
                      <dt>Occupancy</dt>
                      <dd>{formatPercent(property.occupancy_rate)}</dd>
                    </div>
                  </dl>
                  <meter
                    className={styles.meter}
                    min={0}
                    max={1}
                    value={property.occupancy_rate}
                    aria-label={`Occupancy ${formatPercent(property.occupancy_rate)}`}
                  />
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPageChange={setPage} />
        </>
      )}
    </section>
  )
}
