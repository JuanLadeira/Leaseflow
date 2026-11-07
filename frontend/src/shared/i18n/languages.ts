/** Languages the UI ships with. Add one here plus a `locales/<code>.json` per namespace. */
export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'pt-BR', label: 'Português', short: 'PT' },
] as const

export type Language = (typeof LANGUAGES)[number]['code']
export const DEFAULT_LANGUAGE: Language = 'en'
export const LANGUAGE_STORAGE_KEY = 'leaseflow.lang'

export const isLanguage = (value: string | undefined): value is Language =>
  LANGUAGES.some((l) => l.code === value)
