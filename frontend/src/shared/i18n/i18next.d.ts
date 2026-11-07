import 'i18next'
import type { Resources } from './resources'

// Typed keys: `t('common:leadStatus.new')` autocompletes, a typo fails `tsc -b`.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: Resources
  }
}
