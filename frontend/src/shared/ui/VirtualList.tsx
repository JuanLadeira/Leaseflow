import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from './VirtualList.module.css'

interface VirtualListProps<T> {
  items: readonly T[]
  rowHeight: number
  getKey: (item: T) => string | number
  renderItem: (item: T, index: number) => ReactNode
  /** Extra rows rendered above/below the viewport to avoid blank flashes while scrolling. */
  overscan?: number
  /** Used before the container is measured (and in jsdom, where layout is 0). */
  fallbackHeight?: number
  'aria-label': string
}

/**
 * Fixed-row-height windowing: only the rows in view (+ overscan) are in the DOM,
 * so a 5,000-lead inbox renders ~20 rows. Generic over the item type.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  getKey,
  renderItem,
  overscan = 6,
  fallbackHeight = 600,
  'aria-label': ariaLabel,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(fallbackHeight)

  // Measure before paint so the first frame already shows the right rows.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setViewportHeight(el.clientHeight || fallbackHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [fallbackHeight])

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const end = Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan)
  const visible = items.slice(start, end)

  const innerStyle: CSSProperties = { height: items.length * rowHeight }

  return (
    <div
      ref={containerRef}
      className={styles.viewport}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      // A scrollable region must be reachable by keyboard (WCAG 2.1.1).
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      <ul className={styles.inner} style={innerStyle} aria-label={ariaLabel}>
        {visible.map((item, i) => {
          const index = start + i
          return (
            <li
              key={getKey(item)}
              aria-posinset={index + 1}
              aria-setsize={items.length}
              className={styles.row}
              style={{ height: rowHeight, transform: `translateY(${index * rowHeight}px)` }}
            >
              {renderItem(item, index)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
