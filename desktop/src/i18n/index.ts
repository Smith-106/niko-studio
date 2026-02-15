import { useSettingsStore } from '../stores/settingsStore'
import { translations, Language, Translations } from './translations'

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

  // 带参数的翻译函数
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
