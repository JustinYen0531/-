import { describe, it, expect } from 'vitest';
import { TRANSLATIONS } from '../i18n';
import type { Language } from '../i18n';

const SUPPORTED_LANGUAGES: Language[] = ['en', 'zh_tw', 'zh_cn'];

describe('i18n TRANSLATIONS', () => {
  // 1. All 3 languages exist in TRANSLATIONS
  it('should contain all 3 supported languages (en, zh_tw, zh_cn)', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(TRANSLATIONS).toHaveProperty(lang);
      expect(TRANSLATIONS[lang]).toBeDefined();
      expect(typeof TRANSLATIONS[lang]).toBe('object');
    }
  });

  // 2. All languages have the same set of keys (key consistency)
  it('should have the same set of keys across all languages', () => {
    const enKeys = Object.keys(TRANSLATIONS.en).sort();
    const zhTwKeys = Object.keys(TRANSLATIONS.zh_tw).sort();
    const zhCnKeys = Object.keys(TRANSLATIONS.zh_cn).sort();

    expect(zhTwKeys).toEqual(enKeys);
    expect(zhCnKeys).toEqual(enKeys);
  });

  // 3. No translation value is empty string
  it('should not have any empty string values', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const entries = Object.entries(TRANSLATIONS[lang]);
      for (const [key, value] of entries) {
        expect(value, `${lang}.${key} is an empty string`).not.toBe('');
      }
    }
  });

  // 4. No translation value is undefined/null
  it('should not have any undefined or null values', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const entries = Object.entries(TRANSLATIONS[lang]);
      for (const [key, value] of entries) {
        expect(value, `${lang}.${key} is undefined`).not.toBeUndefined();
        expect(value, `${lang}.${key} is null`).not.toBeNull();
      }
    }
  });

  // 5. Template variables are consistent across languages
  it('should have consistent template variables across all languages', () => {
    const templateVarRegex = /\{\{(\w+)\}\}/g;

    const enKeys = Object.keys(TRANSLATIONS.en);
    for (const key of enKeys) {
      const enValue = TRANSLATIONS.en[key];
      const enVars = [...enValue.matchAll(templateVarRegex)]
        .map((m) => m[1])
        .sort();

      if (enVars.length === 0) continue;

      for (const lang of SUPPORTED_LANGUAGES) {
        if (lang === 'en') continue;
        const langTranslations = TRANSLATIONS[lang] as Record<string, string>;
        if (!(key in langTranslations)) continue;

        const langValue = langTranslations[key];
        const langVars = [...langValue.matchAll(templateVarRegex)]
          .map((m) => m[1])
          .sort();

        expect(
          langVars,
          `Template variables mismatch for key "${key}" between en (${enVars.join(', ')}) and ${lang} (${langVars.join(', ')})`
        ).toEqual(enVars);
      }
    }
  });

  // 6. Every key in en exists in zh_tw and zh_cn
  it('should have every English key present in zh_tw', () => {
    const enKeys = Object.keys(TRANSLATIONS.en);
    const zhTwKeys = new Set(Object.keys(TRANSLATIONS.zh_tw));

    const missingKeys = enKeys.filter((key) => !zhTwKeys.has(key));
    expect(
      missingKeys,
      `zh_tw is missing keys: ${missingKeys.join(', ')}`
    ).toEqual([]);
  });

  it('should have every English key present in zh_cn', () => {
    const enKeys = Object.keys(TRANSLATIONS.en);
    const zhCnKeys = new Set(Object.keys(TRANSLATIONS.zh_cn));

    const missingKeys = enKeys.filter((key) => !zhCnKeys.has(key));
    expect(
      missingKeys,
      `zh_cn is missing keys: ${missingKeys.join(', ')}`
    ).toEqual([]);
  });

  // 7. Every key in zh_tw exists in en
  it('should have every zh_tw key present in English', () => {
    const zhTwKeys = Object.keys(TRANSLATIONS.zh_tw);
    const enKeys = new Set(Object.keys(TRANSLATIONS.en));

    const extraKeys = zhTwKeys.filter((key) => !enKeys.has(key));
    expect(
      extraKeys,
      `zh_tw has extra keys not in en: ${extraKeys.join(', ')}`
    ).toEqual([]);
  });

  // 8. Every key in zh_cn exists in en
  it('should have every zh_cn key present in English', () => {
    const zhCnKeys = Object.keys(TRANSLATIONS.zh_cn);
    const enKeys = new Set(Object.keys(TRANSLATIONS.en));

    const extraKeys = zhCnKeys.filter((key) => !enKeys.has(key));
    expect(
      extraKeys,
      `zh_cn has extra keys not in en: ${extraKeys.join(', ')}`
    ).toEqual([]);
  });

  // 9. Language type matches the keys of TRANSLATIONS
  it('should have Language type matching the keys of TRANSLATIONS', () => {
    const translationKeys = Object.keys(TRANSLATIONS).sort();
    const expectedLanguages: string[] = [...SUPPORTED_LANGUAGES].sort();

    expect(translationKeys).toEqual(expectedLanguages);
  });

  // 10. TRANSLATIONS is not empty
  it('should not be empty', () => {
    expect(Object.keys(TRANSLATIONS).length).toBeGreaterThan(0);

    for (const lang of SUPPORTED_LANGUAGES) {
      expect(
        Object.keys(TRANSLATIONS[lang]).length,
        `${lang} has no translation keys`
      ).toBeGreaterThan(0);
    }
  });
});
