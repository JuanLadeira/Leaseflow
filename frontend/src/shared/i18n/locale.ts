import i18n from './i18n'
import { DEFAULT_LANGUAGE } from './languages'

/** BCP 47 tag for Intl formatters: the active UI language. */
export const currentLocale = (): string => i18n.resolvedLanguage ?? DEFAULT_LANGUAGE
