import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from './languages'
import styles from './LanguageSwitcher.module.css'

/** Native <select>: keyboard and screen-reader friendly for free. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const id = useId()
  return (
    <span className={styles.wrapper}>
      <label htmlFor={id} className="visually-hidden">
        {t('language.label')}
      </label>
      <select
        id={id}
        className={styles.select}
        value={i18n.resolvedLanguage}
        onChange={(event) => void i18n.changeLanguage(event.target.value)}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} lang={lang.code}>
            {lang.short} · {lang.label}
          </option>
        ))}
      </select>
    </span>
  )
}
