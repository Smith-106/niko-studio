import { describe, expect, it } from 'vitest';
import { validateEntityType, escapeCypherString } from '../../utils/cypher-safety.js';

describe('cypher-safety branch coverage', () => {
  describe('validateEntityType', () => {
    it('allows valid entity types from the allowlist', () => {
      // All currently allowed types
      expect(() => validateEntityType('Character')).not.toThrow();
      expect(() => validateEntityType('Location')).not.toThrow();
      expect(() => validateEntityType('Event')).not.toThrow();
      expect(() => validateEntityType('Foreshadow')).not.toThrow();
      expect(() => validateEntityType('Plot')).not.toThrow();
      expect(() => validateEntityType('Theme')).not.toThrow();
    });

    it('throws for an invalid entity type not in the allowlist', () => {
      expect(() => validateEntityType('InvalidType')).toThrow(
        'Invalid entity type: "InvalidType". Allowed: Character, Location, Event, Foreshadow, Plot, Theme'
      );
    });

    it('throws for an empty string entity type', () => {
      expect(() => validateEntityType('')).toThrow('Invalid entity type: ""');
    });

    it('includes the disallowed value in the error message', () => {
      try {
        validateEntityType('Hacker');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('Hacker');
        expect((err as Error).message).toContain('Allowed:');
        return;
      }
      // Should not reach here
      expect.unreachable('Expected validateEntityType to throw');
    });
  });

  describe('escapeCypherString', () => {
    it('escapes backslashes by doubling them', () => {
      expect(escapeCypherString('a\\b')).toBe('a\\\\b');
    });

    it('escapes single quotes with backslash', () => {
      expect(escapeCypherString("it's")).toBe("it\\'s");
    });

    it('escapes both backslashes and single quotes in the same string', () => {
      expect(escapeCypherString("it\\'s")).toBe("it\\\\\\'s");
    });

    it('returns the string unchanged when no escaping is needed', () => {
      expect(escapeCypherString('hello world')).toBe('hello world');
    });

    it('handles an empty string', () => {
      expect(escapeCypherString('')).toBe('');
    });

    it('handles a string with only special characters', () => {
      expect(escapeCypherString("\\'")).toBe("\\\\\\'");
    });
  });
});
