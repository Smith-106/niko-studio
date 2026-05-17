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
} from './catalog-loader';

export { _reloadCatalog as reloadCatalog };

export enum SatisfactionPattern {
  POWER_DISPLAY = 'power_display',
  HIDDEN_POWER = 'hidden_power',
  UNDERDOG_WIN = 'underdog_win',
  AUTHORITY_SLAP = 'authority_slap',
  VILLAIN_FAIL = 'villain_fail',
  SWEET_SURPRISE = 'sweet_surprise',
  MYSTERY_SOLVE = 'mystery_solve',
  LEVEL_UP = 'level_up',
  RECOGNITION = 'recognition',
  REVENGE = 'revenge',
}

export interface SatisfactionPatternDef {
  pattern: SatisfactionPattern;
  label: string;
  structure: [string, string, string];
  proportion: [number, number, number];
  keywords: { setup: string[]; payoff: string[]; twist: string[] };
  informationGap: 'reader_ahead' | 'character_ahead' | 'audience_only' | 'none';
}

export const SATISFACTION_PATTERNS: Record<SatisfactionPattern, SatisfactionPatternDef> = getSatisfactionPatterns();

export enum ForeshadowCategory {
  IDENTITY = 'identity',
  ITEM = 'item',
  DIALOGUE = 'dialogue',
  SCENE = 'scene',
  BEHAVIOR = 'behavior',
  RULE = 'rule',
  WORLD = 'world',
}

export const FORESHADOW_HIERARCHY = getForeshadowHierarchy();
export const FORESHADOW_RECOVERY_METHODS = getForeshadowRecoveryMethods();

export enum SuspenseSubgenre {
  HONKAKU = 'honkaku',
  SOCIETAL = 'societal',
  HARD_BOILED = 'hard_boiled',
  THRILLER = 'thriller',
}

export interface SubgenreRules {
  subgenre: SuspenseSubgenre;
  label: string;
  description: string;
  coreRules: string[];
  requiredElements: string[];
  forbiddenElements: string[];
  keywords: { typical: string[]; atypical: string[] };
  referenceWorks: string[];
}

export const SUBGENRE_RULES: Record<SuspenseSubgenre, SubgenreRules> = getSubgenreRules();

export enum NarrativeTechnique {
  ESCALATION_LADDER = 'escalation_ladder',
  REVERSAL_TIMING = 'reversal_timing',
  MULTI_THREAD_WEAVING = 'multi_thread_weaving',
  READER_MANIPULATION = 'reader_manipulation',
  FALSE_RESOLUTION = 'false_resolution',
  TICKING_CLOCK = 'ticking_clock',
  RED_HERRING = 'red_herring',
  DRAMATIC_IRONY = 'dramatic_irony',
}

export interface NarrativeTechniqueDef {
  technique: NarrativeTechnique;
  label: string;
  description: string;
  source: string;
  detectionKeywords: string[];
  effectDescription: string;
  applicationContext: string[];
}

export const NARRATIVE_TECHNIQUES: Record<NarrativeTechnique, NarrativeTechniqueDef> = getNarrativeTechniques();

export enum GenreBeatType {
  MONSTER_IN_THE_HOUSE = 'monster_in_the_house',
  GOLDEN_FLEECE = 'golden_fleece',
  OUT_OF_THE_BOTTLE = 'out_of_the_bottle',
  DUDE_WITH_PROBLEM = 'dude_with_problem',
  RITES_OF_PASSAGE = 'rites_of_passage',
  BUDDY_LOVE = 'buddy_love',
  WHYDUNIT = 'whydunit',
  FOOL_TRIUMPHANT = 'fool_triumphant',
  INSTITUTIONALIZED = 'institutionalized',
  SUPERHERO = 'superhero',
}

export interface GenreBeatTemplate {
  genreType: GenreBeatType;
  label: string;
  description: string;
  beatSequence: { name: string; position: number; description: string; required: boolean }[];
  characterArchetypes: string[];
  keyScenes: string[];
  typicalKeywords: string[];
}

export const GENRE_BEATS: Record<GenreBeatType, GenreBeatTemplate> = getGenreBeats();

export const DIALOGUE_RULES = getDialogueRules();
export const STORY_STRUCTURES = getStoryStructures();
export const WEB_NOVEL_PSYCHOLOGY = getWebNovelPsychology();

export enum UpgradeSystem {
  LEVEL_BASED = 'level_based',
  SKILL_TREE = 'skill_tree',
  REALM_BREAKTHROUGH = 'realm_breakthrough',
  RESOURCE_ACCUMULATION = 'resource_accumulation',
  SOCIAL_RANK = 'social_rank',
}

export interface UpgradeSystemDef {
  system: UpgradeSystem;
  label: string;
  description: string;
  detectionKeywords: string[];
  progressionMarkers: string[];
  satisfactionTriggers: string[];
}

export const UPGRADE_SYSTEMS: Record<UpgradeSystem, UpgradeSystemDef> = getUpgradeSystems();

export enum GoldenFingerType {
  SYSTEM_CHEAT = 'system_cheat',
  REBIRTH_KNOWLEDGE = 'rebirth_knowledge',
  ANCIENT_INHERITANCE = 'ancient_inheritance',
  SPACE_ARTIFACT = 'space_artifact',
  SPECIAL_ABILITY = 'special_ability',
  FORTUNE_REBIRTH = 'fortune_rebirth',
}

export interface GoldenFingerDef {
  type: GoldenFingerType;
  label: string;
  description: string;
  detectionKeywords: string[];
  typicalManifestations: string[];
  powerGrowthPattern: string;
}

export const GOLDEN_FINGERS: Record<GoldenFingerType, GoldenFingerDef> = getGoldenFingers();

export enum AntiPattern {
  INFO_DUMP = 'info_dump',
  PASSIVE_PROTAGONIST = 'passive_protagonist',
  ON_THE_NOSE_DIALOGUE = 'on_the_nose_dialogue',
  WALKING_TALKING = 'walking_talking',
  DEUS_EX_MACHINA = 'deus_ex_machina',
  REDUNDANT_DESCRIPTION = 'redundant_description',
  TELL_NOT_SHOW = 'tell_not_show',
  CONVENIENT_COINCIDENCE = 'convenient_coincidence',
  STATIC_CHARACTER = 'static_character',
  THREAD_ABANDONMENT = 'thread_abandonment',
}

export interface AntiPatternDef {
  pattern: AntiPattern;
  label: string;
  description: string;
  detectionKeywords: string[];
  severity: 'critical' | 'warning' | 'minor';
  fixSuggestion: string;
}

export const ANTI_PATTERNS: Record<AntiPattern, AntiPatternDef> = getAntiPatterns();

export enum NarrativePrinciple {
  SUPPORTING_CHARACTER_RULE = 'supporting_character_rule',
  DIALOGUE_SUBTEXT = 'dialogue_subtext',
  SCENE_CUTTING = 'scene_cutting',
  REVERSAL_SURPRISE = 'reversal_surprise',
  CHARACTER_TRANSFORMATION = 'character_transformation',
  OBSTACLE_ESCALATION = 'obstacle_escalation',
}

export interface NarrativePrincipleDef {
  principle: NarrativePrinciple;
  label: string;
  description: string;
  source: string;
  applicationGuide: string;
  detectionKeywords: string[];
}

export const NARRATIVE_PRINCIPLES: Record<NarrativePrinciple, NarrativePrincipleDef> = getNarrativePrinciples();

export enum MysterySubtype {
  HONKAKU = 'honkaku',
  SOCIAL_FACTION = 'social_faction',
  HARDBOILED = 'hardboiled',
  THRILLER_SUSPENSE = 'thriller_suspense',
}

export interface MysterySubtypeDef {
  subtype: MysterySubtype;
  label: string;
  description: string;
  coreRules: string[];
  typicalElements: string[];
  detectionKeywords: string[];
  forbiddenElements: string[];
  representativeWorks: string[];
}

export const MYSTERY_SUBTYPES: Record<MysterySubtype, MysterySubtypeDef> = getMysterySubtypes();

export enum InteractiveNarrativeType {
  BRANCHING = 'branching',
  MULTI_ENDING = 'multi_ending',
  CHOICE_POINT = 'choice_point',
  ROLEPLAY_DIALOGUE = 'roleplay_dialogue',
  CLUE_COLLECTION = 'clue_collection',
  TIME_PRESSURE = 'time_pressure',
}

export interface InteractiveNarrativeDef {
  type: InteractiveNarrativeType;
  label: string;
  description: string;
  designPrinciples: string[];
  detectionKeywords: string[];
  examples: string[];
}

export const INTERACTIVE_NARRATIVE_TYPES: Record<InteractiveNarrativeType, InteractiveNarrativeDef> = getInteractiveNarrativeTypes();

export enum GameNarrativeStructure {
  QUEST_DRIVEN = 'quest_driven',
  BRANCHING_MAIN = 'branching_main',
  SIDEWEAVE = 'sideweave',
  DIALOGUE_TREE = 'dialogue_tree',
  WORLDSCAPE_FRAGMENT = 'worldscape_fragment',
  CHARACTER_GROWTH = 'character_growth',
}

export interface GameNarrativeDef {
  structure: GameNarrativeStructure;
  label: string;
  description: string;
  designRules: string[];
  detectionKeywords: string[];
}

export const GAME_NARRATIVE_STRUCTURES: Record<GameNarrativeStructure, GameNarrativeDef> = getGameNarrativeStructures();

export enum ComicNarrativeTechnique {
  PANEL_TRANSITION = 'panel_transition',
  SILENT_NARRATIVE = 'silent_narrative',
  MULTI_PERSPECTIVE = 'multi_perspective',
  VISUAL_RHYTHM = 'visual_rhythm',
  TIME_COMPRESS = 'time_compress',
  MONTAGE = 'montage',
}

export interface ComicNarrativeDef {
  technique: ComicNarrativeTechnique;
  label: string;
  description: string;
  principles: string[];
  detectionKeywords: string[];
}

export const COMIC_NARRATIVE_TECHNIQUES: Record<ComicNarrativeTechnique, ComicNarrativeDef> = getComicNarrativeTechniques();

export enum WritingGuideRule {
  DAILY_HABIT = 'daily_habit',
  OUTLINE_FIRST = 'outline_first',
  CHARACTER_DRIVEN = 'character_driven',
  SCENE_PRIORITY = 'scene_priority',
  REVISION_THREE = 'revision_three',
  READER_TEST = 'reader_test',
}

export interface WritingGuideDef {
  rule: WritingGuideRule;
  label: string;
  description: string;
  steps: string[];
  detectionKeywords: string[];
}

export const WRITING_GUIDE_RULES: Record<WritingGuideRule, WritingGuideDef> = getWritingGuideRules();

export enum CommentaryTechnique {
  THESIS_FIRST = 'thesis_first',
  DATA_SUPPORT = 'data_support',
  COUNTER_ARGUMENT = 'counter_argument',
  ANALOGY = 'analogy',
  PROGRESSIVE = 'progressive',
  BALANCED_VIEW = 'balanced_view',
}

export interface CommentaryDef {
  technique: CommentaryTechnique;
  label: string;
  description: string;
  principles: string[];
  detectionKeywords: string[];
}

export const COMMENTARY_TECHNIQUES: Record<CommentaryTechnique, CommentaryDef> = getCommentaryTechniques();

export enum OralNarrativeSkill {
  SUSPENSE_OPENING = 'suspense_opening',
  RHYTHM_CONTROL = 'rhythm_control',
  INTERACTION = 'interaction',
  EMOTIONAL_RESONANCE = 'emotional_resonance',
  REPETITION = 'repetition',
  CLIMAX_ENDING = 'climax_ending',
}

export interface OralNarrativeDef {
  skill: OralNarrativeSkill;
  label: string;
  description: string;
  principles: string[];
  detectionKeywords: string[];
}

export const ORAL_NARRATIVE_SKILLS: Record<OralNarrativeSkill, OralNarrativeDef> = getOralNarrativeSkills();
