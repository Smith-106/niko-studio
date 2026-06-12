import { describe, expect, it } from 'vitest';

import { SKILL_REGISTRY, SkillRouter } from '../../agents/skill-router';

describe('SkillRouter additional coverage', () => {
  it('returns a cloned top-level skill registry snapshot', () => {
    const router = new SkillRouter();

    const snapshot = router.listAllSkills();

    expect(snapshot).not.toBe(SKILL_REGISTRY);
    expect(snapshot['novel-chapter']).toEqual(SKILL_REGISTRY['novel-chapter']);

    delete snapshot['novel-chapter'];

    expect(snapshot['novel-chapter']).toBeUndefined();
    expect(SKILL_REGISTRY['novel-chapter']).toBeDefined();
  });
});
