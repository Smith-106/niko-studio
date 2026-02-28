#!/usr/bin/env python3
"""
AntV Infographic Generation Knowledge Base
Generated: 2025-01-XX
Purpose: Document best practices and patterns for AntV Infographic DSL syntax

Run this script to see comprehensive infographic documentation.
The agent should run this when uncertain about infographic generation.
"""

def print_infographic_knowledge():
    """Print comprehensive AntV Infographic generation knowledge and best practices"""

    knowledge = """
# 🎨 ANTV INFOGRAPHIC GENERATION GUIDE

## 1. CORE CONCEPTS

### What is AntV Infographic?
- Declarative DSL (Domain-Specific Language) for creating infographics
- YAML-like syntax with indentation-based nesting
- Optimized for AI streaming output (fault-tolerant parsing)
- Renders high-quality SVG visualizations

### Syntax Structure
```plain
infographic <template-name>
data
  title Title Text
  desc Description
  items
    - label Item 1
      value 100
      desc Details
      icon mdi/rocket
theme
  palette #3b82f6 #8b5cf6 #f97316
```

## 2. DATA STRUCTURE

### Basic Data Format
```plain
data
  title Optional Title
  desc Optional Description
  items
    - label Required Label
      value Optional Number
      desc Optional Description
      icon Optional Icon (mdi/name or collection/name)
      time Optional Time Label
```

### Comparison Templates (CRITICAL)
For `compare-*` templates, you MUST use two root items with children:

✅ CORRECT:
```plain
infographic compare-binary-horizontal-badge-card-arrow
data
  title Competitive Analysis
  items
    - label Traditional Approach
      children
        - label Feature 1
        - label Feature 2
    - label Modern Approach
      children
        - label Feature A
        - label Feature B
```

❌ WRONG (will render blank):
```plain
data
  left
    title Traditional
    items
      - Feature 1
  right
    title Modern
    items
      - Feature A
```

### Hierarchical Data (children)
```plain
data
  items
    - label Parent Item
      children
        - label Child 1
          desc Details
        - label Child 2
          children
            - label Grandchild
```

## 3. TEMPLATE CATEGORIES

### Sequence Templates (Timelines, Processes)
Use for: step-by-step processes, timelines, roadmaps, development stages

Examples:
- `sequence-roadmap-vertical-simple` - Vertical timeline
- `sequence-ascending-steps` - Staircase progression
- `sequence-pyramid-simple` - Pyramid hierarchy
- `sequence-circular-simple` - Circular process flow

```plain
infographic sequence-roadmap-vertical-simple
data
  title Project Timeline
  items
    - time Q1 2024
      label Planning
      desc Initial research and design
      icon mdi/calendar-clock
    - time Q2 2024
      label Development
      desc Core features implementation
      icon mdi/code-tags
    - time Q3 2024
      label Launch
      desc Public release
      icon mdi/rocket-launch
theme
  palette #1F4E79 #2E75B6 #70AD47
```

### List Templates (Feature Lists, Grids)
Use for: feature lists, product highlights, grid layouts

Examples:
- `list-grid-badge-card` - Grid of feature cards
- `list-row-horizontal-icon-arrow` - Horizontal flow with icons
- `list-sector-plain-text` - Radial sector layout

```plain
infographic list-grid-badge-card
data
  title Key Features
  items
    - label Feature 1
      desc Detailed description
      icon mdi/star
    - label Feature 2
      desc Another feature
      icon mdi/check-circle
    - label Feature 3
      desc Third feature
      icon mdi/lightning-bolt
theme
  palette #3b82f6 #8b5cf6 #f97316
```

### Comparison Templates (Pros/Cons, Before/After)
Use for: side-by-side comparisons, pros/cons, SWOT analysis

Examples:
- `compare-binary-horizontal-badge-card-arrow` - Side-by-side with arrow
- `compare-swot` - 2x2 SWOT matrix
- `compare-binary-horizontal-underline-text-vs` - VS style comparison

```plain
infographic compare-binary-horizontal-badge-card-arrow
data
  title Product Comparison
  items
    - label Product A
      children
        - label Feature 1
        - label Feature 2
        - label Feature 3
    - label Product B
      children
        - label Feature X
        - label Feature Y
        - label Feature Z
theme
  palette #D32F2F #70AD47
```

### Chart Templates (Data Visualization)
Use for: bar charts, pie charts, line charts

Examples:
- `chart-column-simple` - Column/bar chart
- `chart-pie-donut-plain-text` - Donut chart
- `chart-line-plain-text` - Line chart

```plain
infographic chart-column-simple
data
  title Sales by Quarter
  items
    - label Q1
      value 120
    - label Q2
      value 150
    - label Q3
      value 180
    - label Q4
      value 200
theme
  palette #1F4E79 #2E75B6 #70AD47 #70AD47
```

### Hierarchy Templates (Org Charts, Trees)
Use for: organizational charts, tree structures, hierarchies

Examples:
- `hierarchy-tree-tech-style-capsule-item` - Tech-style org chart
- `hierarchy-tree-curved-line-rounded-rect-node` - Curved tree

```plain
infographic hierarchy-tree-tech-style-capsule-item
data
  title Organization Structure
  items
    - label CEO
      children
        - label CTO
          children
            - label Engineering Lead
            - label Product Lead
        - label CFO
          children
            - label Finance Team
theme
  palette #3b82f6 #8b5cf6
```

### Quadrant Templates (2x2 Matrices)
Use for: priority matrices, risk analysis, decision frameworks

Examples:
- `quadrant-quarter-simple-card` - 2x2 quadrant
- `quadrant-quarter-circular` - Circular quadrant

```plain
infographic quadrant-quarter-simple-card
data
  title Priority Matrix
  items
    - label High Impact, Low Effort
      desc Quick wins
      icon mdi/rocket
    - label High Impact, High Effort
      desc Strategic initiatives
      icon mdi/target
    - label Low Impact, Low Effort
      desc Fill-ins
      icon mdi/clock
    - label Low Impact, High Effort
      desc Thankless tasks
      icon mdi/alert
theme
  palette #10b981 #3b82f6 #f59e0b #ef4444
```

## 4. ICONS & ILLUSTRATIONS

### Icon Format
- Format: `<collection>/<icon-name>`
- Popular collections:
  - `mdi/*` - Material Design Icons (most common)
  - `fa/*` - Font Awesome
  - `bi/*` - Bootstrap Icons
  - `heroicons/*` - Heroicons

### Common Icon Examples
```plain
# Technology
icon mdi/code-tags
icon mdi/database
icon mdi/api
icon mdi/cloud
icon mdi/server

# Business
icon mdi/chart-line
icon mdi/briefcase
icon mdi/currency-usd
icon mdi/trending-up

# Process
icon mdi/check-circle
icon mdi/arrow-right
icon mdi/cog
icon mdi/play-circle

# People
icon mdi/account
icon mdi/account-group
icon mdi/shield-account
```

### Illustrations (illus)
For larger visual elements:
- Format: illustration filename (without .svg)
- Browse: https://undraw.co/illustrations
- Examples: `coding`, `programmer`, `server`, `business-plan`

```plain
data
  items
    - label Development
      illus coding
      desc Software engineering
```

## 5. THEMES & STYLING

### Color Palette
```plain
theme
  palette #3b82f6 #8b5cf6 #f97316 #10b981 #f43f5e
```

### Dark Mode
```plain
theme
  dark
  palette #61DDAA #F6BD16 #F08BB4
```

### Custom Colors
```plain
theme
  colorPrimary #1F4E79
  colorBg #FFFFFF
  palette #2E75B6 #70AD47
```

## 6. COMMON PATTERNS

### Timeline with Dates
```plain
infographic sequence-roadmap-vertical-simple
data
  title Project Milestones
  items
    - time Jan 2024
      label Kickoff
      desc Project initiation
    - time Mar 2024
      label MVP
      desc Minimum viable product
    - time Jun 2024
      label Launch
      desc Public release
```

### Feature Comparison
```plain
infographic compare-binary-horizontal-badge-card-arrow
data
  title Feature Comparison
  items
    - label Basic Plan
      children
        - label Feature A
        - label Feature B
    - label Pro Plan
      children
        - label Feature A
        - label Feature B
        - label Feature C
        - label Feature D
```

### Process Steps
```plain
infographic list-row-horizontal-icon-arrow
data
  title Workflow Process
  items
    - label Step 1
      desc Initial setup
      icon mdi/play
    - label Step 2
      desc Configuration
      icon mdi/cog
    - label Step 3
      desc Execution
      icon mdi/rocket
    - label Step 4
      desc Review
      icon mdi/check-circle
```

### Data Chart
```plain
infographic chart-column-simple
data
  title Revenue Growth
  items
    - label 2021
      value 1.2
      unit M
    - label 2022
      value 2.5
      unit M
    - label 2023
      value 4.8
      unit M
    - label 2024
      value 8.1
      unit M
```

## 7. BEST PRACTICES

### ✅ DO:
1. **Use correct structure for comparison templates** - Always use two root items with children
2. **Include meaningful labels** - Every item should have a clear label
3. **Use appropriate templates** - Match template to content type (timeline → sequence-*, comparison → compare-*)
4. **Add icons** - Icons make infographics more visually appealing
5. **Use consistent color palettes** - Stick to 2-5 colors that work well together
6. **Add descriptions** - Descriptions provide context for items

### ❌ DON'T:
1. **Don't use left/right keys for comparison** - Use two root items with children instead
2. **Don't mix template categories** - Use sequence-* for timelines, compare-* for comparisons
3. **Don't omit required fields** - Items need at least a label
4. **Don't use too many colors** - Stick to 2-5 colors max
5. **Don't create overly complex hierarchies** - Keep nesting to 2-3 levels max

## 8. TROUBLESHOOTING

### Blank Rendering
- **Check comparison template structure** - Must use two root items with children, not left/right keys
- **Verify template name** - Template must exist in the available list
- **Check indentation** - Use 2 spaces for indentation consistently

### Missing Icons
- **Verify icon format** - Must be `collection/icon-name` (e.g., `mdi/rocket`)
- **Check icon collection** - Use popular collections like `mdi`, `fa`, `bi`

### Color Issues
- **Verify hex format** - Colors must start with `#` (e.g., `#3b82f6`)
- **Check palette count** - Most templates work best with 2-5 colors

## 9. TEMPLATE SELECTION GUIDE

| Content Type | Recommended Templates |
|-------------|----------------------|
| Timeline / Process Steps | `sequence-roadmap-vertical-simple`, `sequence-ascending-steps` |
| Feature List | `list-grid-badge-card`, `list-row-horizontal-icon-arrow` |
| Comparison (2 items) | `compare-binary-horizontal-badge-card-arrow` |
| SWOT Analysis | `compare-swot` |
| Data Chart | `chart-column-simple`, `chart-pie-donut-plain-text` |
| Org Chart | `hierarchy-tree-tech-style-capsule-item` |
| Priority Matrix | `quadrant-quarter-simple-card` |

## 10. COMPLETE EXAMPLES

### Example 1: Business Timeline
```plain
infographic sequence-roadmap-vertical-simple
data
  title Business Growth Timeline
  items
    - time Year 1
      label Foundation
      desc 5K users, $500K ARR
      icon mdi/foundation
    - time Year 2
      label Scale
      desc 50K users, $5M ARR
      icon mdi/rocket
    - time Year 3
      label Dominate
      desc 250K users, $25M ARR
      icon mdi/crown
theme
  palette #1F4E79 #2E75B6 #70AD47
```

### Example 2: Product Comparison
```plain
infographic compare-binary-horizontal-badge-card-arrow
data
  title Competitive Positioning
  items
    - label Traditional PKM
      children
        - label Notion/Obsidian
        - label Generic note-taking
        - label No AI integration
    - label Nowledge Mem
      children
        - label AI-native memory
        - label Knowledge graph
        - label Privacy-first
        - label MCP-integrated
theme
  palette #D32F2F #70AD47
```

### Example 3: Market Growth Chart
```plain
infographic chart-column-simple
data
  title AI Memory Market Growth
  items
    - label 2025
      value 6.27
      unit B
    - label 2030
      value 28.45
      unit B
theme
  palette #1F4E79 #2E75B6 #70AD47
```

---

For more templates and examples, visit: https://infographic.antv.vision/
"""

    print(knowledge)


if __name__ == '__main__':
    print_infographic_knowledge()

