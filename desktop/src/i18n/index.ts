import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { useSettingsStore } from '../stores/settingsStore'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'
import { translations, type Language, type Translations } from './translations'

// ---------------------------------------------------------------------------
// i18next initialization
// ---------------------------------------------------------------------------

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: {
    escapeValue: false,
  },
})

// Map the legacy Language type to i18next locale codes
const LANGUAGE_TO_LOCALE: Record<Language, string> = {
  zh: 'zh-CN',
  en: 'en-US',
}

/**
 * Sync i18next language with the persisted settings store.
 * Call this once at app startup and whenever the language setting changes.
 */
export function syncI18nLanguage(): void {
  const { settings } = useSettingsStore.getState()
  const locale = LANGUAGE_TO_LOCALE[settings.language ?? 'zh'] ?? 'zh-CN'
  if (i18n.language !== locale) {
    i18n.changeLanguage(locale)
  }
}

// ---------------------------------------------------------------------------
// Legacy compatibility: useI18n hook
// ---------------------------------------------------------------------------
// The existing codebase uses `const { t, translate, language } = useI18n()`
// where `t` is a flat record of translation strings and `translate` supports
// `{key}` interpolation.  We keep this API working by reading from the
// legacy `translations` object so that none of the 36+ consuming files
// need to change.

const ensureTranslationShape = (): void => {
  const zhKeys = Object.keys(translations.zh)
  const enKeys = Object.keys(translations.en)

  const zhOnly = zhKeys.filter((key) => !enKeys.includes(key))
  const enOnly = enKeys.filter((key) => !zhKeys.includes(key))

  if (zhOnly.length > 0 || enOnly.length > 0) {
    throw new Error(`i18n key mismatch: zhOnly=[${zhOnly.join(',')}], enOnly=[${enOnly.join(',')}]`)
  }
}

ensureTranslationShape()

export function useI18n() {
  const { settings } = useSettingsStore()
  const language = (settings.language || 'zh') as Language

  const t = translations[language]

  // Parameterized translation function (legacy API)
  const translate = (key: keyof Translations, params?: Record<string, string | number>): string => {
    let text = t[key] || key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v))
      })
    }
    return text
  }

  return {
    t,
    translate,
    language,
  }
}

export { translations, type Language, type Translations }
export { i18n }
