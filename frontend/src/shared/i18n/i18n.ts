import i18n, { type Resource } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, LANGUAGES } from './languages'

/** Keeps `<html lang>` in sync so screen readers and the browser pick the right language. */
function syncDocumentLang(lng: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
}

/**
 * Starts i18next with the namespaces the app composes (see app/i18n). Shared code
 * only knows the instance; it never imports feature translations itself.
 */
export function initI18n(resources: Resource) {
  if (i18n.isInitialized) return i18n
  i18n.on('languageChanged', syncDocumentLang)
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      supportedLngs: LANGUAGES.map((l) => l.code),
      fallbackLng: DEFAULT_LANGUAGE,
      load: 'currentOnly',
      defaultNS: 'common',
      ns: Object.keys(resources[DEFAULT_LANGUAGE] ?? {}),
      interpolation: { escapeValue: false }, // React already escapes
      detection: {
        // ?lng=pt-BR first (handy for demo links), then the saved choice, then the browser.
        order: ['querystring', 'localStorage', 'navigator'],
        lookupQuerystring: 'lng',
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: ['localStorage'],
        // "pt", "pt-PT" → pt-BR; "en-GB" → en
        convertDetectedLanguage: (lng) => {
          const lower = lng.toLowerCase()
          if (lower.startsWith('pt')) return 'pt-BR'
          if (lower.startsWith('en')) return 'en'
          return lng
        },
      },
      react: { useSuspense: false },
    })
  syncDocumentLang(i18n.resolvedLanguage ?? DEFAULT_LANGUAGE)
  return i18n
}

export default i18n
