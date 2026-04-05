import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as graph from '../../graph';
import { GraphEngine as DirectGraphEngine, Relation as DirectRelation } from '../../graph/graph-engine';
import { CypherParser as DirectCypherParser, GraphManager as DirectGraphManager } from '../../graph/graph-manager';

describe('graph/index barrel', () => {
  it('re-exports representative graph classes, helpers, and types through the public entrypoint', () => {
    expect(graph.GraphEngine).toBe(DirectGraphEngine);
    expect(graph.CypherParser).toBe(DirectCypherParser);
    expect(graph.GraphManager).toBe(DirectGraphManager);
    expect(graph.Relation).toBe(DirectRelation);

    const parsed = graph.CypherParser.parse("MATCH (c:Character) RETURN c LIMIT 5");

    expect(parsed).toMatchObject({
      type: 'MATCH',
      return: 'c',
      limit: 5,
    });
  });

  it('provides a working graph engine through the barrel', async () => {
    const tempDir = join(tmpdir(), `niko-graph-barrel-${randomUUID()}`);
    const engine = new graph.GraphEngine(join(tempDir, 'graph.db'));

    try {
      const created = await engine.createEntity('Character', 'Alice', { role: 'lead' });
      const character = await engine.getCharacter('Alice', false, false);
      const query = await engine.executeCypher("MATCH (c:Character) WHERE c.name = 'Alice' RETURN c");

      expect(created).toMatchObject({ status: 'created' });
      expect(character).toMatchObject({
        name: 'Alice',
        type: 'Character',
        properties: { role: 'lead' },
      });
      expect(query).toHaveLength(1);
      expect(query[0]).toMatchObject({
        c: {
          name: 'Alice',
          type: 'Character',
          properties: { role: 'lead' },
        },
      });
    } finally {
      engine.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
