import { createContext, use } from 'react'

export type Tone = 'success' | 'error'
export type Notify = (message: string, tone?: Tone) => void

export const ToastContext = createContext<Notify | null>(null)

/** Show a toast: `notify('Reply sent')`. Rendered by <ToastProvider>. */
export function useToast(): Notify {
  const ctx = use(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
