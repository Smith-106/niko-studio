import {
  reloadCatalog as _reloadCatalog,
  getSatisfactionPatterns,
  getNarrativeTechniques,
  getForeshadowHierarchy,
  getForeshadowRecoveryMethods,
  getSubgenreRules,
  getGenreBeats,
  getDialogueRules,
  getStoryStructures,
  getWebNovelPsychology,
  getUpgradeSystems,
  getGoldenFingers,
  getAntiPatterns,
  getNarrativePrinciples,
  getMysterySubtypes,
  getInteractiveNarrativeTypes,
  getGameNarrativeStructures,
  getComicNarrativeTechniques,
  getWritingGuideRules,
  getCommentaryTechniques,
  getOralNarrativeSkills,
} from './catalog-loader';

export type {
  ForeshadowHierarchyData,
  ForeshadowRecoveryMethodsData,
  DialogueRulesData,
  StoryStructureData,
  StoryStructureBeat,
  WebNovelPsychologyData,
} from './craft-types';

export { _reloadCatalog as reloadCatalog };

export * from './craft-types';

// Lazy getter wrappers — calling these re-evaluates through catalog-loader
// which respects reloadCatalog() cache invalidation.

export function getSatisfactionPatternsCatalog(): ReturnType<typeof getSatisfactionPatterns> {
  return getSatisfactionPatterns();
}

export function getForeshadowHierarchyCatalog(): ReturnType<typeof getForeshadowHierarchy> {
  return getForeshadowHierarchy();
}

export function getForeshadowRecoveryMethodsCatalog(): ReturnType<typeof getForeshadowRecoveryMethods> {
  return getForeshadowRecoveryMethods();
}

export function getSubgenreRulesCatalog(): ReturnType<typeof getSubgenreRules> {
  return getSubgenreRules();
}

export function getNarrativeTechniquesCatalog(): ReturnType<typeof getNarrativeTechniques> {
  return getNarrativeTechniques();
}

export function getGenreBeatsCatalog(): ReturnType<typeof getGenreBeats> {
  return getGenreBeats();
}

export function getDialogueRulesCatalog(): ReturnType<typeof getDialogueRules> {
  return getDialogueRules();
}

export function getStoryStructuresCatalog(): ReturnType<typeof getStoryStructures> {
  return getStoryStructures();
}

export function getWebNovelPsychologyCatalog(): ReturnType<typeof getWebNovelPsychology> {
  return getWebNovelPsychology();
}

export function getUpgradeSystemsCatalog(): ReturnType<typeof getUpgradeSystems> {
  return getUpgradeSystems();
}

export function getGoldenFingersCatalog(): ReturnType<typeof getGoldenFingers> {
  return getGoldenFingers();
}

export function getAntiPatternsCatalog(): ReturnType<typeof getAntiPatterns> {
  return getAntiPatterns();
}

export function getNarrativePrinciplesCatalog(): ReturnType<typeof getNarrativePrinciples> {
  return getNarrativePrinciples();
}

export function getMysterySubtypesCatalog(): ReturnType<typeof getMysterySubtypes> {
  return getMysterySubtypes();
}

export function getInteractiveNarrativeTypesCatalog(): ReturnType<typeof getInteractiveNarrativeTypes> {
  return getInteractiveNarrativeTypes();
}

export function getGameNarrativeStructuresCatalog(): ReturnType<typeof getGameNarrativeStructures> {
  return getGameNarrativeStructures();
}

export function getComicNarrativeTechniquesCatalog(): ReturnType<typeof getComicNarrativeTechniques> {
  return getComicNarrativeTechniques();
}

export function getWritingGuideRulesCatalog(): ReturnType<typeof getWritingGuideRules> {
  return getWritingGuideRules();
}

export function getCommentaryTechniquesCatalog(): ReturnType<typeof getCommentaryTechniques> {
  return getCommentaryTechniques();
}

export function getOralNarrativeSkillsCatalog(): ReturnType<typeof getOralNarrativeSkills> {
  return getOralNarrativeSkills();
}
