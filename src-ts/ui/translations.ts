/**
 * UI Translations
 *
 * i18n strings for LOCK system labels and other UI text.
 */

type TranslateFn = (key: string) => string;

const LOCK_LABELS: Record<string, Record<string, string>> = {
  en: {
    lock_system_score: 'LOCK System Score',
    lock_L: 'Lead',
    lock_O: 'Objective',
    lock_C: 'Confrontation',
    lock_K: 'Knockout',
    lock_L_desc: 'Does the scene establish a clear leading thread?',
    lock_O_desc: 'Is there a well-defined goal or objective?',
    lock_C_desc: 'Does a meaningful conflict or tension exist?',
    lock_K_desc: 'Does the scene deliver a decisive outcome?',
    lock_L_tooltip: 'Lead measures narrative direction clarity',
    lock_O_tooltip: 'Objective measures goal definition strength',
    lock_C_tooltip: 'Confrontation measures dramatic tension',
    lock_K_tooltip: 'Knockout measures resolution impact',
  },
  zh: {
    lock_system_score: 'LOCK 系统评分',
    lock_L: '引导线',
    lock_O: '目标',
    lock_C: '冲突',
    lock_K: '决胜',
    lock_L_desc: '场景是否建立了清晰的引导线索？',
    lock_O_desc: '是否有明确的目标或意图？',
    lock_C_desc: '是否存在有意义的冲突或张力？',
    lock_K_desc: '场景是否给出了决定性的结果？',
    lock_L_tooltip: '引导线衡量叙事方向的清晰度',
    lock_O_tooltip: '目标衡量目标定义的强度',
    lock_C_tooltip: '冲突衡量戏剧张力',
    lock_K_tooltip: '决胜衡量结局的冲击力',
  },
};

export const translations: Record<string, TranslateFn> = {
  en: (key: string) => LOCK_LABELS.en[key] ?? key,
  zh: (key: string) => LOCK_LABELS.zh[key] ?? key,
};

export function t(lang: string, key: string): string {
  const fn = translations[lang] ?? translations.en;
  return fn(key);
}
