# F-008: Localization Expansion

> Priority: LOW | Phase: M10+ | Depends: None
> Roles: product-manager

---

## Requirements Summary

Expand i18n support beyond zh-CN and en-US to additional locales (ja-JP, ko-KR, and key European languages). This is a deferred item from M6 with low urgency but long-term market expansion value.

**MUST**:
- i18n infrastructure supports additional locales without code changes
- ja-JP and ko-KR locale files with complete translations
- Right-to-left (RTL) layout consideration for future Arabic/Hebrew support

**SHOULD**:
- Community translation contribution workflow (JSON file-based)
- Locale-specific date/number formatting
- Language detection from system locale on first launch

**MAY**:
- Additional European languages (de-DE, fr-FR, es-ES)
- In-app language switcher without restart
- Translation coverage reporting

---

## Design Decisions (40%+)

1. **JSON locale files**: Existing i18n system uses JSON locale files. New locales are added by creating new JSON files — no infrastructure changes needed.

2. **System locale detection**: On first launch, detect system language and auto-select locale if available. Fall back to en-US if locale not supported.

3. **RTL as future consideration**: CSS layout uses logical properties (start/end instead of left/right) where feasible. Full RTL support deferred until Arabic/Hebrew are requested.

---

## Interface Contract

No new interfaces needed — existing i18n system (`useI18n` hook) handles all locales.

### Locale File Structure

```
src/i18n/locales/
  zh-CN.json  ← existing
  en-US.json  ← existing
  ja-JP.json  ← new
  ko-KR.json  ← new
```

---

## Acceptance Criteria

- [ ] ja-JP locale file with complete translations
- [ ] ko-KR locale file with complete translations
- [ ] App auto-detects system locale and switches language
- [ ] All existing UI elements render correctly in new locales
- [ ] Date/number formatting adapts to locale

---

## Cross-Feature Dependencies

- None (independent of other features)
