/**
 * i18n/index.ts
 * Minimal i18n hook. Currently only pt-BR is supported.
 * To add a new language: create the file and add it to the map below.
 */
import { ptBR } from './pt-BR'

export type Locale = 'pt-BR'

const translations = {
  'pt-BR': ptBR,
}

// Active locale — can be made reactive if needed
const activeLocale: Locale = 'pt-BR'

export const t = translations[activeLocale]

/** Hook for components — returns the translations object */
export function useTranslation() {
  return { t }
}

export type { Translations } from './pt-BR'
