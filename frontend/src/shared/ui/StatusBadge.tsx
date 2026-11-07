import type { LeadStatus, UnitStatus } from '@/shared/api/types'
import { LEAD_STATUS_LABEL, UNIT_STATUS_LABEL } from '@/shared/lib/format'
import styles from './StatusBadge.module.css'

type Props = { kind: 'lead'; status: LeadStatus } | { kind: 'unit'; status: UnitStatus }

export function StatusBadge(props: Props) {
  const label =
    props.kind === 'lead' ? LEAD_STATUS_LABEL[props.status] : UNIT_STATUS_LABEL[props.status]
  return <span className={`${styles.badge} ${styles[props.status]}`}>{label}</span>
}
