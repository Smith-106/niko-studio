import { describe, expect, it } from 'vitest';

import { validateSchemaVersion } from '../../../workflow/engine/preflight.js';

describe('workflow/engine/preflight additional coverage', () => {
  it('accepts missing schema versions and supported 1.x variants', () => {
    expect(() => validateSchemaVersion({})).not.toThrow();
    expect(() => validateSchemaVersion({ schema_version: null })).not.toThrow();
    expect(() => validateSchemaVersion({ schema_version: '1.0' })).not.toThrow();
    expect(() => validateSchemaVersion({ schemaVersion: '1.2.3' })).not.toThrow();
  });

  it('rejects unsupported schema versions with a clear upgrade message', () => {
    expect(() => validateSchemaVersion({ schema_version: '2.0' })).toThrow(
      'Unsupported workflow schema version "2.0". Supported: 1.x. Update the workflow definition or downgrade the engine.',
    );
    expect(() => validateSchemaVersion({ schemaVersion: 'beta' })).toThrow(
      'Unsupported workflow schema version "beta". Supported: 1.x. Update the workflow definition or downgrade the engine.',
    );
  });
});
