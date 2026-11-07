import styles from './Spinner.module.css'
import { useTranslation } from 'react-i18next'

export function Spinner({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <output className={styles.wrapper}>
      <span className={styles.spinner} aria-hidden="true" />
      <span className="visually-hidden">{label ?? t('loading')}</span>
    </output>
  )
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className={styles.fullPage}>
      <Spinner label={label} />
    </div>
  )
}
