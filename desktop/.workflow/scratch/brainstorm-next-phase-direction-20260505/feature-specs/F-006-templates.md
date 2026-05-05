# F-006: Template & Scaffold System

> Priority: LOW-MEDIUM | Phase: M9-P1 | Depends: F-001 (project context)
> Roles: product-manager, ux-expert

---

## Requirements Summary

Provide reusable document templates so writers don't start from a blank page every time. Templates capture structural patterns (novel chapter, short story, essay, script) and can be created from existing documents.

**MUST**:
- Built-in template library: novel chapter, short story, essay, script, academic paper
- Create template from existing chapter (save structure + placeholder variables)
- Apply template when creating new chapter
- Template includes: title, description, outline sections, placeholder text

**SHOULD**:
- User-defined placeholder variables ({{character_name}}, {{location}}, etc.)
- Template preview before applying
- Import/export templates as JSON files

**MAY**:
- Template marketplace (local file sharing)
- AI-generated templates based on genre/style

---

## Design Decisions (40%+)

1. **Template = TipTap JSON + metadata schema**: Templates are stored as TipTap JSON content with a metadata envelope (title, description, category, placeholders). Consistent with editor format — no conversion needed.

2. **Placeholder syntax**: `{{variable_name}}` in text content. On template application, prompt user to fill in variables via a form. Simple string replacement.

3. **Template storage**: User templates in `~/.niko-studio/templates/` as JSON files. Built-in templates bundled with app. Separation allows user customization without app updates.

4. **Template application flow**: New Chapter → "From Template" → Browse → Preview → Fill Variables → Create. Integrated into chapter creation dialog.

---

## Interface Contract

```typescript
interface Template {
  id: string
  title: string
  description: string
  category: 'novel' | 'short-story' | 'essay' | 'script' | 'academic' | 'custom'
  content: TipTapJSON
  placeholders: TemplatePlaceholder[]
  isBuiltIn: boolean
}

interface TemplatePlaceholder {
  name: string
  label: string
  defaultValue?: string
  type: 'text' | 'number' | 'select'
  options?: string[]  // for select type
}
```

---

## Acceptance Criteria

- [ ] 5 built-in templates available in chapter creation dialog
- [ ] User can save current chapter as template
- [ ] Template preview shows rendered content
- [ ] Placeholder variables replaced on template application
- [ ] Templates stored as JSON files in user directory

---

## Cross-Feature Dependencies

- **F-001 (Project Management)**: Templates applied at chapter creation within project
