/**
 * Translation resources, one namespace per feature folder.
 * Each feature keeps its strings next to its code in `locales/<lang>.json`;
 * this file (in app/, which may depend on features) is the only place that wires them together.
 */
import authEn from '@/features/auth/locales/en.json'
import authPt from '@/features/auth/locales/pt-BR.json'
import dashboardEn from '@/features/dashboard/locales/en.json'
import dashboardPt from '@/features/dashboard/locales/pt-BR.json'
import propertiesEn from '@/features/properties/locales/en.json'
import propertiesPt from '@/features/properties/locales/pt-BR.json'
import leadsEn from '@/features/leads/locales/en.json'
import leadsPt from '@/features/leads/locales/pt-BR.json'
import commonEn from '@/shared/locales/en.json'
import commonPt from '@/shared/locales/pt-BR.json'
import type { Language } from '@/shared/i18n/languages'

/** English is the source of truth: its shape types every `t()` key. */
export const en = {
  common: commonEn,
  auth: authEn,
  dashboard: dashboardEn,
  properties: propertiesEn,
  leads: leadsEn,
}

export type Resources = typeof en

/** Every other language must provide exactly the same namespaces (checked by tsc). */
export const resources: Record<Language, Record<keyof Resources, object>> = {
  en,
  'pt-BR': {
    common: commonPt,
    auth: authPt,
    dashboard: dashboardPt,
    properties: propertiesPt,
    leads: leadsPt,
  },
}
