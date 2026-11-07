/**
 * Translation resources, one namespace per feature folder.
 * Each feature keeps its strings next to its code in `locales/<lang>.json`;
 * this file is the only place that wires them together.
 */
import commonEn from '@/shared/locales/en.json'
import commonPt from '@/shared/locales/pt-BR.json'
import type { Language } from './languages'

/** English is the source of truth: its shape types every `t()` key. */
export const en = {
  common: commonEn,
}

export type Resources = typeof en

/** Every other language must provide exactly the same namespaces (checked by tsc). */
export const resources: Record<Language, Record<keyof Resources, object>> = {
  en,
  'pt-BR': {
    common: commonPt,
  },
}
