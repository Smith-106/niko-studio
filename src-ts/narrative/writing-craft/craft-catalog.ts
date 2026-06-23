import {
  reloadCatalog as _reloadCatalog,
  getSatisfactionPatterns,
  getNarrativeTechniques,
  getForeshadowHierarchy,
  getForeshadowRecoveryMethods,
  getSubgenreRules,
  getGenreBeats,
  getStoryStructures,
  getDialogueRules,
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

export const SATISFACTION_PATTERNS = getSatisfactionPatterns();

export const FORESHADOW_HIERARCHY = getForeshadowHierarchy();
export const FORESHADOW_RECOVERY_METHODS = getForeshadowRecoveryMethods();

export const SUBGENRE_RULES = getSubgenreRules();

export const NARRATIVE_TECHNIQUES = getNarrativeTechniques();

export const GENRE_BEATS = getGenreBeats();

export const DIALOGUE_RULES = getDialogueRules();
export const STORY_STRUCTURES = getStoryStructures();
export const WEB_NOVEL_PSYCHOLOGY = getWebNovelPsychology();

export const UPGRADE_SYSTEMS = getUpgradeSystems();

export const GOLDEN_FINGERS = getGoldenFingers();

export const ANTI_PATTERNS = getAntiPatterns();

export const NARRATIVE_PRINCIPLES = getNarrativePrinciples();

export const MYSTERY_SUBTYPES = getMysterySubtypes();

export const INTERACTIVE_NARRATIVE_TYPES = getInteractiveNarrativeTypes();

export const GAME_NARRATIVE_STRUCTURES = getGameNarrativeStructures();

export const COMIC_NARRATIVE_TECHNIQUES = getComicNarrativeTechniques();

export const WRITING_GUIDE_RULES = getWritingGuideRules();

export const COMMENTARY_TECHNIQUES = getCommentaryTechniques();

export const ORAL_NARRATIVE_SKILLS = getOralNarrativeSkills();
