import { en } from './en'
import { es } from './es'
import { fr } from './fr'

export const translations = {
  en,
  es,
  fr,
  de: en, // Placeholder - use English for now
  ja: en, // Placeholder - use English for now
  ko: en, // Placeholder - use English for now
  zh: en, // Placeholder - use English for now
  pt: en, // Placeholder - use English for now
  ru: en, // Placeholder - use English for now
  ar: en, // Placeholder - use English for now
} as const

export type TranslationKey = keyof typeof translations.en
