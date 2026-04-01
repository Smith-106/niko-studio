import { useEffect } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { getThemeDefinition, type ThemeId } from '../styles/themes'

export function useTheme() {
  const { settings } = useSettingsStore()
  const { theme } = settings

  useEffect(() => {
    const root = document.documentElement
    const definition = getThemeDefinition(theme)

    // Set data-theme attribute
    root.setAttribute('data-theme', definition.id)

    // Toggle dark class for backward compatibility during transition
    if (definition.isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    // Apply token overrides from theme definition
    for (const [key, value] of Object.entries(definition.tokens)) {
      root.style.setProperty(key, value)
    }

    // For system mode, listen for changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => {
        const sysDef = getThemeDefinition('system')
        root.setAttribute('data-theme', sysDef.id)
        if (sysDef.isDark) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
        for (const [key, value] of Object.entries(sysDef.tokens)) {
          root.style.setProperty(key, value)
        }
      }
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [theme])

  return { theme: theme as ThemeId }
}
