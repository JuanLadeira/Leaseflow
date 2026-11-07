import styles from './Pagination.module.css'
import { useTranslation } from 'react-i18next'

interface PaginationProps {
  page: number
  pageSize: number
  count: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, count, onPageChange }: PaginationProps) {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (pages <= 1) return null
  return (
    <nav className={styles.pagination} aria-label={t('pagination.label')}>
      <button
        type="button"
        className="btn"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        {t('actions.previous')}
      </button>
      <span aria-live="polite">
        {t('pagination.page', { page, pages })}
      </span>
      <button
        type="button"
        className="btn"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
      >
        {t('actions.next')}
      </button>
    </nav>
  )
}
