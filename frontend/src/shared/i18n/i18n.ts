import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, LANGUAGES } from './languages'
import { resources } from './resources'

/** Keeps `<html lang>` in sync so screen readers and the browser pick the right language. */
function syncDocumentLang(lng: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
}

i18n.on('languageChanged', syncDocumentLang)

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: LANGUAGES.map((l) => l.code),
    fallbackLng: DEFAULT_LANGUAGE,
    // "pt", "pt-PT" → pt-BR, "en-GB" → en
    nonExplicitSupportedLngs: false,
    load: 'currentOnly',
    defaultNS: 'common',
    ns: Object.keys(resources.en),
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      // ?lng=pt-BR first (handy for demo links), then the saved choice, then the browser.
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lng',
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
      convertDetectedLanguage: (lng) => {
        if (lng.toLowerCase().startsWith('pt')) return 'pt-BR'
        if (lng.toLowerCase().startsWith('en')) return 'en'
        return lng
      },
    },
    react: { useSuspense: false },
  })

syncDocumentLang(i18n.resolvedLanguage ?? DEFAULT_LANGUAGE)

export default i18n
