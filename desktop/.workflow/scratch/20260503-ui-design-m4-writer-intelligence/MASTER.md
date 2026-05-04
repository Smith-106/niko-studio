# M4 Writer Intelligence Dashboard — Master Design Specification

**Selected Variant**: A — Observatory
**Date**: 2026-05-03
**Status**: Final

## Design Direction

Data-dense dashboard with scientific clarity. Maximizes information per viewport using compact rows, semantic color badges, inline sparklines, and badge-based categorization. Optimizes for writers who want maximum intelligence density — see everything at once, drill down selectively.

## 6D Attribute Profile

| Dimension | Value |
|-----------|-------|
| Color Temperature | Cool |
| Contrast Level | High |
| Visual Density | Dense |
| Rounding | Soft |
| Animation | Subtle |
| Theme Personality | Professional |

## Component Styles

### Card
- Background: `var(--surface-elevated)`
- Border: `1px solid var(--border-default)`
- Radius: `var(--radius-sm)` (8px)
- Padding: `12px 14px`
- Shadow: `var(--shadow-tiny)`
- Hover shadow: `var(--shadow-default)`

### Data Row
- Background: `transparent`
- Border bottom: `1px solid var(--border-default)`
- Padding: `8px 12px`
- Font size: `var(--shell-font-compact)`
- Line height: `var(--shell-line-compact)`

### Badge (Semantic)
| State | Background | Color |
|-------|-----------|-------|
| Success | `rgba(16, 185, 129, 0.12)` | `#059669` |
| Warning | `rgba(245, 158, 11, 0.12)` | `#d97706` |
| Danger | `rgba(239, 68, 68, 0.12)` | `#dc2626` |
- Radius: `var(--radius-pill)` (20px)
- Padding: `2px 10px`
- Font size: `0.6875rem`
- Font weight: `600`

### Section Header
- Font size: `var(--shell-font-label)`
- Font weight: `700`
- Text transform: `uppercase`
- Letter spacing: `0.05em`
- Color: `var(--text-secondary)`
- Margin bottom: `8px`
- Padding bottom: `6px`
- Border bottom: `1px solid var(--border-default)`

### Metric Value
- Font size: `1.5rem`
- Font weight: `700`
- Line height: `1`
- Color: `var(--text-primary)`

### Metric Label
- Font size: `var(--shell-font-label)`
- Color: `var(--text-muted)`
- Margin top: `2px`

### Progress Bar
- Height: `4px`
- Background: `var(--surface-sunken)`
- Fill: `var(--primary-cta)`
- Radius: `2px`

## Layout Specifications

### 1. Foreshadowing Tracker — Timeline Table

**Structure**: Timeline table grouped by foreshadow ID
**Columns**: status_icon | event_type | description_truncated | chapter_ref | date
**Grouping**: By foreshadow_id
**Interaction**: Click row to expand full excerpt

```
┌─────────────────────────────────────────────────┐
│ FORESHADOWING TRACKER                    [filter]│
│─────────────────────────────────────────────────│
│ ● Arc: "传承之剑"                    3 events   │
│ ├─ 🌱 Plant  "父亲的遗言..."        Ch.2  5/1   │
│ ├─ 💡 Hint   "剑上的刻痕..."        Ch.5  5/2   │
│ └─ ⚡ Harvest "拔出传承之剑..."      Ch.12 5/3   │
│                                                  │
│ ○ Arc: "暗影组织"                    2 events   │
│ ├─ 🌱 Plant  "神秘的信件..."        Ch.3  5/1   │
│ └─ 💡 Hint   "巷中的低语..."        Ch.7  5/2   │
└─────────────────────────────────────────────────┘
```

### 2. Pattern Dashboard — Categorized Grid

**Structure**: Auto-fill grid of pattern cards
**Grid**: `repeat(auto-fill, minmax(180px, 1fr))`
**Card content**: pattern_name | occurrence_count | chapter_list_badges | severity_indicator
**Grouping**: By pattern type

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 反复意象     │ │ 叙事模式     │ │ 角色模式     │
│ 🔢 12次      │ │ 🔢 5次       │ │ 🔢 8次       │
│ Ch.2 5 7 9   │ │ Ch.1 3 6     │ │ Ch.2 4 8 11  │
│ ●●●○        │ │ ●●○○        │ │ ●●●●        │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 3. Session Analytics — Metric Row Grid

**Structure**: Top summary cards (3-column) + scrollable session list
**Top metrics**: total_sessions | avg_session_length | total_words
**Session list columns**: date | duration | word_count | chapter_context

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 总会话      │ │ 平均时长    │ │ 总字数      │
│ 24          │ │ 47min       │ │ 52,300      │
└─────────────┘ └─────────────┘ └─────────────┘
─────────────────────────────────────────────────
5/3  1h23m  3,200字  Ch.7-8    │
5/2  0h45m  1,800字  Ch.6      │
5/1  2h10m  5,400字  Ch.4-5    │
```

### 4. Evaluation Drill-Down — Expandable Table

**Structure**: Accordion-expandable score table
**Columns**: evaluator_name | score_badge | status_indicator
**Expanded row**: reasoning_text | affected_excerpts | suggested_fix

```
┌─────────────────────────────────────────────────┐
│ EVALUATION DRILL-DOWN                           │
│─────────────────────────────────────────────────│
│ ▸ 节奏评估      ● 78/100   ↑                    │
│ ▸ 角色一致性    ● 85/100   →                    │
│ ▾ 悬念设置      ● 62/100   ↓                    │
│   ┌───────────────────────────────────────────┐ │
│   │ 推理: 第7章缺少必要的铺垫，反转过于突兀  │ │
│   │ 摘录: "突然真相大白..."                   │ │
│   │ 建议: 在第4-5章增加伏笔线索              │ │
│   └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 5. Character Relationships — Structured List

**Structure**: Grouped list by character
**Row content**: character_name | relationship_type_badge | target_name | evidence_excerpt
**Interaction**: Click to navigate to chapter

```
┌─────────────────────────────────────────────────┐
│ CHARACTER RELATIONSHIPS                 [filter] │
│─────────────────────────────────────────────────│
│ 李云飞                                          │
│ ├─ [师徒] → 王老    "师父的指点让他..." Ch.3   │
│ ├─ [对立] → 暗影    "两人第一次交锋..." Ch.8   │
│ └─ [盟友] → 苏瑶    "并肩作战..."       Ch.10  │
│                                                  │
│ 苏瑶                                            │
│ └─ [盟友] → 李云飞  "她信任他..."      Ch.6    │
└─────────────────────────────────────────────────┘
```

## Spacing Tokens

| Token | Value |
|-------|-------|
| Section gap | 16px |
| Card gap | 10px |
| Row gap | 0px |
| Inner padding | 14px |

## Typography

| Element | Size | Weight | Transform |
|---------|------|--------|-----------|
| Panel title | 0.9375rem | 700 | none |
| Section title | var(--shell-font-label) | 700 | uppercase |
| Body | var(--shell-font-compact) | 400 | none |
| Caption | var(--shell-font-label) | 400 | none |

## Animation Tokens

See `animation-tokens.json` for full specification. Key values:

| Transition | Duration | Easing |
|-----------|----------|--------|
| Panel enter | 200ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Accordion expand | 120ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Badge pulse | 600ms | ease-out |
| Row highlight | 1200ms | ease-out |
| Card hover | 150ms | ease-out |
| List stagger | 15ms/item (max 300ms) | — |

## Interaction Patterns

1. **Accordion expand/collapse** — Click row to reveal detail section. Only one row expanded at a time (Evaluation Drill-Down) or multiple (Foreshadowing Tracker).
2. **Click-to-navigate** — Chapter references are clickable links that scroll the editor to the relevant position.
3. **Semantic badges** — Status uses green/amber/red color coding. Pattern severity uses filled dots.
4. **Inline truncation** — Long descriptions truncated with ellipsis; click reveals full text.
5. **Filter chips** — Top-right filter buttons for pattern types, relationship types, etc.

## Accessibility

- Focus trap within open panel (existing `useDialogFocusTrap`)
- All interactive elements keyboard-navigable (Tab + Enter/Space)
- Badge colors supplemented with text labels for color-blind users
- Section headers use proper heading hierarchy
- ARIA labels on icon-only buttons
- Screen reader announcements for score changes

## Theme Compatibility

All colors reference CSS variables that switch between light and dark themes:
- `var(--surface-elevated)` → white in light, `#1e293b` in dark
- `var(--border-default)` → `#e2e8f0` in light, `#334155` in dark
- `var(--text-primary)` → `#0f172a` in light, `#f8fafc` in dark
- Badge semantic colors remain constant across themes (opacity-based backgrounds adapt naturally)
