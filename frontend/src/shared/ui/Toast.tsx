import { useState, type ReactNode } from 'react'
import { CircleCheck, CircleAlert, X } from 'lucide-react'
import styles from './Toast.module.css'

import { ToastContext, type Notify, type Tone } from './toastContext'

interface Toast {
  id: number
  message: string
  tone: Tone
}
const DURATION_MS = 4000
let nextId = 1

/**
 * Lightweight toasts for confirmations ("Reply sent"). The region is a polite
 * live region, so screen readers announce each toast without moving focus.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = (id: number) => setToasts((all) => all.filter((toast) => toast.id !== id))
  const notify: Notify = (message, tone = 'success') => {
    const id = nextId++
    setToasts((all) => [...all.slice(-2), { id, message, tone }])
    setTimeout(() => dismiss(id), DURATION_MS)
  }

  return (
    <ToastContext value={notify}>
      {children}
      <output className={styles.region} aria-live="polite">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CircleCheck : CircleAlert
          return (
            <div key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
              <Icon aria-hidden="true" className={styles.icon} />
              <span className={styles.message}>{toast.message}</span>
              <button
                type="button"
                className={styles.close}
                aria-label="Dismiss notification"
                onClick={() => dismiss(toast.id)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </output>
    </ToastContext>
  )
}
