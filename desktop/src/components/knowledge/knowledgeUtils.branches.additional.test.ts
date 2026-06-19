import { describe, expect, it } from 'vitest'

import { createDefaultProjectWorkspaceContext } from '../../types/workspace'
import {
  buildCypherProps,
  buildWorkspaceNotice,
  escapeCypherString,
  filterWorkspaceKnowledgeItems,
  readGraphMutationError,
  toGraphItems,
  validateEntityType,
} from './knowledgeUtils'

const workspace = createDefaultProjectWorkspaceContext({
  workspaceRoot: '/tmp/atlas-project',
})
workspace.identity.projectId = 'project-1'
workspace.identity.workspaceId = 'workspace-1'

describe('knowledgeUtils branch coverage', () => {
  // ── asRecord: Array input returns null (line 6 branch) ──
  describe('toGraphItems — asRecord Array branch', () => {
    it('normalizes array value as a graph item when key exists and value is Array (typeof is object)', () => {
      // Arrays pass `typeof value === 'object'` check on line 50
      const items = toGraphItems([{ n: [1, 2, 3] }], 'n')
      expect(items).toHaveLength(1)
      // normalizeGraphItem([1,2,3]) — arrays have no meaningful name/id
      expect(items[0]).toMatchObject({ name: '', id: '', description: '' })
    })

    it('returns { value } when row has key but value is a primitive', () => {
      const items = toGraphItems([{ n: 42 }], 'n')
      // key exists but value is not object → falls through
      // row is object → normalizeGraphItem(row)
      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ n: 42 })
    })

    it('returns { value } when row is not an object', () => {
      const items = toGraphItems([123, true, null], 'n')
      // none are objects → all hit line 57 fallback
      expect(items).toHaveLength(3)
      expect(items[0]).toEqual({ value: '123' })
      expect(items[1]).toEqual({ value: 'true' })
      expect(items[2]).toEqual({ value: 'null' })
    })

    it('returns { value } when row is object but missing key', () => {
      const items = toGraphItems([{ other: 'data' }], 'n')
      // row is object but "n" not in row → skips first if → hits second if → normalizeGraphItem(row)
      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ other: 'data' })
    })
  })

  // ── readString: whitespace-only string returns null (line 14 branch) ──
  describe('readString — whitespace branch via normalizeGraphItem', () => {
    it('treats whitespace-only name as null and falls through to next source', () => {
      const item = toGraphItems(
        [
          {
            n: {
              id: 'ws-id',
              name: '   ',
              properties: { name: 'fallback-name' },
            },
          },
        ],
        'n',
      )
      expect(item[0]).toMatchObject({ name: 'fallback-name' })
    })

    it('treats whitespace-only description as null and falls through to content', () => {
      const item = toGraphItems(
        [
          {
            n: {
              id: 'ws-desc',
              description: '  \t  ',
              content: 'actual content',
            },
          },
        ],
        'n',
      )
      expect(item[0]).toMatchObject({ description: 'actual content' })
    })
  })

  // ── normalizeGraphItem: properties null, description/content fallback chains ──
  describe('normalizeGraphItem — properties null and description fallbacks', () => {
    it('handles null properties by using empty object fallback', () => {
      const item = toGraphItems(
        [
          {
            n: {
              id: 'no-props',
              name: 'DirectName',
              description: 'DirectDesc',
            },
          },
        ],
        'n',
      )
      // properties is null → asRecord returns null → {} fallback
      expect(item[0]).toMatchObject({
        id: 'no-props',
        name: 'DirectName',
        description: 'DirectDesc',
      })
    })

    it('falls through description chain: description→content→properties.description→properties.summary→properties.content→properties.details', () => {
      // Test properties.summary fallback
      const item1 = toGraphItems(
        [
          {
            n: {
              id: 'sum-1',
              properties: { summary: 'from-summary' },
            },
          },
        ],
        'n',
      )
      expect(item1[0]).toMatchObject({ description: 'from-summary' })

      // Test properties.details fallback
      const item2 = toGraphItems(
        [
          {
            n: {
              id: 'det-1',
              properties: { details: 'from-details' },
            },
          },
        ],
        'n',
      )
      expect(item2[0]).toMatchObject({ description: 'from-details' })

      // Test item.content fallback (no description)
      const item3 = toGraphItems(
        [
          {
            n: {
              id: 'cont-1',
              content: 'from-item-content',
            },
          },
        ],
        'n',
      )
      expect(item3[0]).toMatchObject({ description: 'from-item-content' })

      // Test properties.content fallback (no description, no item.content)
      const item4 = toGraphItems(
        [
          {
            n: {
              id: 'pcont-1',
              properties: { content: 'from-props-content' },
            },
          },
        ],
        'n',
      )
      expect(item4[0]).toMatchObject({ description: 'from-props-content' })
    })

    it('prefers item.content over properties.content for the content field', () => {
      const item = toGraphItems(
        [
          {
            n: {
              id: 'cc-1',
              content: 'item-content',
              properties: { content: 'props-content' },
            },
          },
        ],
        'n',
      )
      expect(item[0]).toMatchObject({ content: 'item-content' })
    })

    it('uses description as content fallback when both item.content and properties.content are missing', () => {
      const item = toGraphItems(
        [
          {
            n: {
              id: 'cd-1',
              description: 'desc-as-content',
            },
          },
        ],
        'n',
      )
      expect(item[0]).toMatchObject({ content: 'desc-as-content' })
    })

    it('falls to empty string when all description sources are null', () => {
      const item = toGraphItems(
        [
          {
            n: {
              id: 'empty-1',
              name: 'Empty',
            },
          },
        ],
        'n',
      )
      expect(item[0]).toMatchObject({ description: '' })
    })

    it('resolves title from properties.title when item.title is missing', () => {
      const item = toGraphItems(
        [
          {
            n: {
              id: 'pt-1',
              properties: { title: 'props-title' },
            },
          },
        ],
        'n',
      )
      expect(item[0]).toMatchObject({ title: 'props-title' })
    })

    it('resolves title from item.type when both item.title and properties.title are missing', () => {
      const item = toGraphItems(
        [
          {
            n: {
              id: 'tt-1',
              type: 'Character',
            },
          },
        ],
        'n',
      )
      expect(item[0]).toMatchObject({ title: 'Character' })
    })

    it('resolves name from item.id when name is missing everywhere', () => {
      const item = toGraphItems(
        [
          {
            n: {
              id: 'id-as-name',
            },
          },
        ],
        'n',
      )
      expect(item[0]).toMatchObject({ name: 'id-as-name', id: 'id-as-name' })
    })
  })

  // ── filterWorkspaceKnowledgeItems: dedup priority branch (!existingScoped && incomingScoped) ──
  describe('filterWorkspaceKnowledgeItems — dedup priority', () => {
    it('replaces legacy item with scoped item when keys match', () => {
      const items = [
        // legacy item — no workspaceId or projectId
        { id: 'legacy-1', name: 'Hero', type: 'character', updated_at: '2024-01-01T00:00:00.000Z' },
        // scoped item — has workspaceId, same name+type key
        {
          id: 'scoped-1',
          name: 'Hero',
          type: 'character',
          workspaceId: 'workspace-1',
          updated_at: '2024-01-02T00:00:00.000Z',
        },
      ]
      const result = filterWorkspaceKnowledgeItems(items, workspace)
      // legacy first → set in map; scoped second → !existingScoped(true for legacy) && incomingScoped(true for scoped) → replace
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ id: 'scoped-1' })
    })

    it('keeps existing scoped item when incoming is also scoped', () => {
      const items = [
        {
          id: 'scoped-a',
          name: 'Hero',
          type: 'character',
          workspaceId: 'workspace-1',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'scoped-b',
          name: 'Hero',
          type: 'character',
          projectId: 'project-1',
          updated_at: '2024-01-02T00:00:00.000Z',
        },
      ]
      const result = filterWorkspaceKnowledgeItems(items, workspace)
      expect(result).toHaveLength(1)
      // existing is scoped → !existingScoped is false → no replacement
      expect(result[0]).toMatchObject({ id: 'scoped-a' })
    })

    it('keeps legacy item when incoming is also legacy', () => {
      const items = [
        { id: 'legacy-a', name: 'Hero', type: 'character', updated_at: '2024-01-01T00:00:00.000Z' },
        { id: 'legacy-b', name: 'Hero', type: 'character', updated_at: '2024-01-02T00:00:00.000Z' },
      ]
      const result = filterWorkspaceKnowledgeItems(items, workspace)
      expect(result).toHaveLength(1)
      // existing is legacy, incoming is also legacy → !existingScoped(true) && incomingScoped(false) → no replace
      expect(result[0]).toMatchObject({ id: 'legacy-a' })
    })
  })

  // ── filterWorkspaceKnowledgeItems: itemKind filter mismatch ──
  describe('filterWorkspaceKnowledgeItems — itemKind mismatch', () => {
    it('skips items where itemKind does not match the filter', () => {
      const items = [
        { id: 'story-1', name: 'Story', type: 'event', workspaceId: 'workspace-1', itemKind: 'story' },
        { id: 'misc-1', name: 'Misc', type: 'event', workspaceId: 'workspace-1', itemKind: 'misc' },
      ]
      const result = filterWorkspaceKnowledgeItems(items, workspace, { itemKind: 'story' })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ id: 'story-1' })
    })

    it('keeps items with no itemKind when filter is specified (itemKind is null → mismatch)', () => {
      const items = [
        { id: 'no-kind', name: 'NoKind', type: 'event', workspaceId: 'workspace-1' },
      ]
      const result = filterWorkspaceKnowledgeItems(items, workspace, { itemKind: 'story' })
      // itemKind is null → options.itemKind truthy but itemKind null → condition is false → not skipped
      // Wait: the condition is "options.itemKind && itemKind && itemKind !== options.itemKind"
      // If itemKind is null/undefined, the && short-circuits → condition is false → NOT skipped
      // So items with no itemKind pass through when filter is set
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ id: 'no-kind' })
    })
  })

  // ── buildCypherProps: non-string values (line 148-149) ──
  describe('buildCypherProps — non-string values', () => {
    it('serializes numbers and booleans as JSON', () => {
      expect(buildCypherProps({ count: 5, active: true, tag: null })).toBe(
        '{count: 5, active: true, tag: null}',
      )
    })

    it('mixes string and non-string values', () => {
      expect(buildCypherProps({ name: "O'Brien", level: 3 })).toBe(
        "{name: 'O\\'Brien', level: 3}",
      )
    })

    it('returns empty props for empty object', () => {
      expect(buildCypherProps({})).toBe('{}')
    })
  })

  // ── escapeCypherString: backslash escaping ──
  describe('escapeCypherString — backslash escaping', () => {
    it('escapes backslashes before single quotes', () => {
      expect(escapeCypherString("path\\to'file")).toBe("path\\\\to\\'file")
    })

    it('escapes multiple backslashes', () => {
      expect(escapeCypherString('a\\b\\c')).toBe('a\\\\b\\\\c')
    })

    it('escapes only backslashes when no quotes present', () => {
      expect(escapeCypherString('no-quotes\\slash')).toBe('no-quotes\\\\slash')
    })

    it('leaves normal strings unchanged', () => {
      expect(escapeCypherString('simple text')).toBe('simple text')
    })
  })

  // ── readGraphMutationError — various empty/null cases ──
  describe('readGraphMutationError — edge cases', () => {
    it('returns null when rows is empty array', () => {
      expect(readGraphMutationError([])).toBeNull()
    })

    it('returns null when first row has no error property', () => {
      expect(readGraphMutationError([{ data: 'ok' }])).toBeNull()
    })

    it('returns null when first row is not a record (is array)', () => {
      expect(readGraphMutationError([['not', 'a', 'record']])).toBeNull()
    })

    it('returns null when first row is null', () => {
      expect(readGraphMutationError([null])).toBeNull()
    })

    it('returns null when error field is not a string', () => {
      expect(readGraphMutationError([{ error: 500 }])).toBeNull()
    })

    it('returns null when error field is whitespace-only string', () => {
      expect(readGraphMutationError([{ error: '   ' }])).toBeNull()
    })

    it('returns trimmed error string', () => {
      expect(readGraphMutationError([{ error: '  merge failed  ' }])).toBe('merge failed')
    })
  })

  // ── validateEntityType — invalid entity type ──
  describe('validateEntityType — invalid type', () => {
    it('throws for invalid entity type', () => {
      expect(() => validateEntityType('Malicious')).toThrow(
        'Invalid entity type: "Malicious". Allowed: Character, Location, Event, Foreshadow, Plot, Theme, Item',
      )
    })

    it('passes for valid entity types', () => {
      for (const valid of ['Character', 'Location', 'Event', 'Foreshadow', 'Plot', 'Theme', 'Item']) {
        expect(() => validateEntityType(valid)).not.toThrow()
      }
    })

    it('throws for empty string', () => {
      expect(() => validateEntityType('')).toThrow('Invalid entity type: ""')
    })
  })

  // ── buildWorkspaceNotice — English language branch ──
  describe('buildWorkspaceNotice — English branch', () => {
    it('returns English notice strings', () => {
      const en = buildWorkspaceNotice('en')
      expect(en).toEqual([
        'Story Bible and knowledge entries now persist into the active workspace authority and survive reloads.',
        'Import and export remain available for legacy local-draft compatibility, not as the primary source of truth.',
      ])
    })

    it('returns Chinese notice strings', () => {
      const zh = buildWorkspaceNotice('zh')
      expect(zh).toHaveLength(2)
      expect(zh[0]).toContain('Story Bible')
      expect(zh[1]).toContain('导入')
    })
  })

  // ── Sorting fallback: when timestamps are not finite or equal ──
  describe('filterWorkspaceKnowledgeItems — sorting fallback', () => {
    it('sorts by name when timestamps are invalid', () => {
      const items = [
        { id: 'b', name: 'Beta', type: 't', updated_at: 'not-a-date' },
        { id: 'a', name: 'Alpha', type: 't', updated_at: 'also-bad' },
      ]
      const result = filterWorkspaceKnowledgeItems(items, workspace)
      expect(result[0]).toMatchObject({ name: 'Alpha' })
      expect(result[1]).toMatchObject({ name: 'Beta' })
    })

    it('sorts by name when timestamps are equal', () => {
      const items = [
        { id: 'b', name: 'Beta', type: 't', updated_at: '2024-06-01T00:00:00.000Z' },
        { id: 'a', name: 'Alpha', type: 't', updated_at: '2024-06-01T00:00:00.000Z' },
      ]
      const result = filterWorkspaceKnowledgeItems(items, workspace)
      expect(result[0]).toMatchObject({ name: 'Alpha' })
      expect(result[1]).toMatchObject({ name: 'Beta' })
    })
  })

  // ── toGraphItems: rows not array ──
  describe('toGraphItems — non-array input', () => {
    it('returns empty array for undefined input', () => {
      expect(toGraphItems(undefined, 'n')).toEqual([])
    })

    it('returns empty array for non-array input', () => {
      expect(toGraphItems('not-array' as unknown as unknown[], 'n')).toEqual([])
    })
  })

  // ── filterWorkspaceKnowledgeItems: remaining uncovered branches (lines 91, 106-107, 111) ──
  describe('filterWorkspaceKnowledgeItems — key and sort edge cases', () => {
    it('uses "item" and "unknown" as fallbacks when name/id/type are all empty', () => {
      // Line 91: `readString(item.name) ?? readString(item.id) ?? 'item'` and `readString(item.type) ?? 'unknown'`
      const items = [
        { workspaceId: 'workspace-1' }, // no name, id, or type
      ]
      const result = filterWorkspaceKnowledgeItems(items, workspace)
      expect(result).toHaveLength(1)
    })

    it('sorts by created_at when updated_at is missing', () => {
      // Line 106-107: `left.updated_at ?? left.created_at ?? 0`
      const items = [
        { id: 'newer', name: 'Newer', type: 't', created_at: '2024-06-02T00:00:00.000Z' },
        { id: 'older', name: 'Older', type: 't', created_at: '2024-06-01T00:00:00.000Z' },
      ]
      const result = filterWorkspaceKnowledgeItems(items, workspace)
      expect(result[0]).toMatchObject({ id: 'newer' })
      expect(result[1]).toMatchObject({ id: 'older' })
    })

    it('sorts by name when updated_at and created_at are both missing and names differ', () => {
      // Line 111: `String(left.name ?? '')` and `String(right.name ?? '')` — name is null/undefined
      // Both items have no timestamps → all ?? branches on 106-107 fire
      // One item has no name → `?? ''` fires for that side
      const items = [
        { id: 'named-item', name: 'Beta', type: 't' },
        { id: 'no-name-item', type: 't' }, // name missing → falls to ''
      ]
      const result = filterWorkspaceKnowledgeItems(items, workspace)
      // '' (empty name) sorts before 'Beta' in localeCompare
      expect(result[0]).toMatchObject({ id: 'no-name-item' })
      expect(result[1]).toMatchObject({ id: 'named-item' })
    })

    it('sorts by name when both items have no name (both hit ?? fallback on line 111)', () => {
      const items = [
        { id: 'item-a', type: 't' },
        { id: 'item-b', type: 't' },
      ]
      const result = filterWorkspaceKnowledgeItems(items, workspace)
      // Both names are missing → both hit ?? '' → compare '' vs ''
      expect(result).toHaveLength(2)
    })

    it('deduplicates with fallback key when items have no name or id', () => {
      // Two items with no name/id/type → same fallback key "item::unknown"
      const items = [
        { workspaceId: 'workspace-1' },
        { workspaceId: 'workspace-1', description: 'second' },
      ]
      const result = filterWorkspaceKnowledgeItems(items, workspace)
      expect(result).toHaveLength(1)
    })
  })
})
