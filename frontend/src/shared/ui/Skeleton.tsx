import styles from './Skeleton.module.css'

/**
 * Placeholder lines shaped like the content that is loading. Purely visual:
 * the region that wraps it should carry `aria-busy` and a label.
 */
export function Skeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <span className={`${styles.stack} ${className}`} aria-hidden="true" data-testid="skeleton">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={styles.line} />
      ))}
    </span>
  )
}

export function SkeletonBlock({ height = '10rem' }: { height?: string }) {
  return <span className={styles.block} style={{ height }} aria-hidden="true" />
}
