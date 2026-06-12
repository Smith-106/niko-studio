import { describe, expect, it } from 'vitest';

import * as embeddingProtocol from '../../protocols/embedding.js';
import * as llmProtocol from '../../protocols/llm.js';

describe('protocol runtime modules', () => {
  it('loads embedding and llm protocol modules as side-effect free runtime modules', () => {
    expect(Object.keys(embeddingProtocol)).toEqual([]);
    expect(Object.keys(llmProtocol)).toEqual([]);
  });
});
