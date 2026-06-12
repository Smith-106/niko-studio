import { describe, expect, it } from 'vitest';

import { t, translations } from '../../ui/translations.js';

describe('ui translations', () => {
  it('returns translated LOCK labels for supported languages', () => {
    expect(translations.en('lock_system_score')).toBe('LOCK System Score');
    expect(translations.zh('lock_K')).toBe('决胜');
  });

  it('falls back to the original key when a translation is missing', () => {
    expect(translations.en('missing_key')).toBe('missing_key');
    expect(translations.zh('missing_key')).toBe('missing_key');
  });

  it('falls back to English when the language is unsupported', () => {
    expect(t('fr', 'lock_L_desc')).toBe('Does the scene establish a clear leading thread?');
  });
});
