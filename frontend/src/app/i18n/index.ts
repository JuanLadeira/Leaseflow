import { initI18n } from '@/shared/i18n/i18n'
import { resources } from './resources'

/** Imported once by main.tsx and the test setup, before anything renders. */
export const i18n = initI18n(resources)
