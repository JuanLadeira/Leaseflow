import styles from './Logo.module.css'

/** Brand mark: a stylised roof over a door, drawn inline so it themes with tokens. */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className={styles.mark}>
        <rect width="32" height="32" rx="8" className={styles.tile} />
        <path d="M8 15.5 16 9l8 6.5V23a1 1 0 0 1-1 1h-4.5v-5h-5v5H9a1 1 0 0 1-1-1z" fill="#fff" />
      </svg>
      Leaseflow
    </span>
  )
}
