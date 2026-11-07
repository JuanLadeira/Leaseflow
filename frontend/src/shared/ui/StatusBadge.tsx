import { useTranslation } from 'react-i18next'
import type { LeadStatus, UnitStatus } from '@/shared/api/types'
import styles from './StatusBadge.module.css'

type Props = { kind: 'lead'; status: LeadStatus } | { kind: 'unit'; status: UnitStatus }

export function StatusBadge(props: Props) {
  const { t } = useTranslation()
  const label = props.kind === 'lead' ? t(`leadStatus.${props.status}`) : t(`unitStatus.${props.status}`)
  return <span className={`${styles.badge} ${styles[props.status]}`}>{label}</span>
}
