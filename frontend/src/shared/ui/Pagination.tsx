import styles from './Pagination.module.css'

interface PaginationProps {
  page: number
  pageSize: number
  count: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, count, onPageChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (pages <= 1) return null
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <button
        type="button"
        className="btn"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        Previous
      </button>
      <span aria-live="polite">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        className="btn"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
      >
        Next
      </button>
    </nav>
  )
}
