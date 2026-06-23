import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import type {
  SatisfactionPattern,
  SatisfactionPatternDef,
  SuspenseSubgenre,
  SubgenreRules,
  NarrativeTechnique,
  NarrativeTechniqueDef,
  GenreBeatType,
  GenreBeatTemplate,
  UpgradeSystem,
  UpgradeSystemDef,
  GoldenFingerType,
  GoldenFingerDef,
  AntiPattern,
  AntiPatternDef,
  NarrativePrinciple,
  NarrativePrincipleDef,
  MysterySubtype,
  MysterySubtypeDef,
  InteractiveNarrativeType,
  InteractiveNarrativeDef,
  GameNarrativeStructure,
  GameNarrativeDef,
  ComicNarrativeTechnique,
  ComicNarrativeDef,
  WritingGuideRule,
  WritingGuideDef,
  CommentaryTechnique,
  CommentaryDef,
  OralNarrativeSkill,
  OralNarrativeDef,
  ForeshadowHierarchyData,
  ForeshadowRecoveryMethodsData,
  DialogueRulesData,
  StoryStructureData,
  StoryStructureBeat,
  WebNovelPsychologyData,
} from './craft-types';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(MODULE_DIR, 'catalog-data');

function loadJson(filename: string): unknown {
  const filePath = path.join(DATA_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

interface CatalogCache {
  satisfactionPatterns: Record<SatisfactionPattern, SatisfactionPatternDef> | null;
  narrativeTechniques: Record<NarrativeTechnique, NarrativeTechniqueDef> | null;
  foreshadowHierarchy: ForeshadowHierarchyData | null;
  foreshadowRecoveryMethods: ForeshadowRecoveryMethodsData | null;
  subgenreRules: Record<SuspenseSubgenre, SubgenreRules> | null;
  genreBeats: Record<GenreBeatType, GenreBeatTemplate> | null;
  storyStructures: StoryStructureData | null;
  dialogueRules: DialogueRulesData | null;
  webNovelPsychology: WebNovelPsychologyData | null;
  upgradeSystems: Record<UpgradeSystem, UpgradeSystemDef> | null;
  goldenFingers: Record<GoldenFingerType, GoldenFingerDef> | null;
  antiPatterns: Record<AntiPattern, AntiPatternDef> | null;
  narrativePrinciples: Record<NarrativePrinciple, NarrativePrincipleDef> | null;
  mysterySubtypes: Record<MysterySubtype, MysterySubtypeDef> | null;
  interactiveNarrativeTypes: Record<InteractiveNarrativeType, InteractiveNarrativeDef> | null;
  gameNarrativeStructures: Record<GameNarrativeStructure, GameNarrativeDef> | null;
  comicNarrativeTechniques: Record<ComicNarrativeTechnique, ComicNarrativeDef> | null;
  writingGuideRules: Record<WritingGuideRule, WritingGuideDef> | null;
  commentaryTechniques: Record<CommentaryTechnique, CommentaryDef> | null;
  oralNarrativeSkills: Record<OralNarrativeSkill, OralNarrativeDef> | null;
}

const cache: CatalogCache = {
  satisfactionPatterns: null,
  narrativeTechniques: null,
  foreshadowHierarchy: null,
  foreshadowRecoveryMethods: null,
  subgenreRules: null,
  genreBeats: null,
  storyStructures: null,
  dialogueRules: null,
  webNovelPsychology: null,
  upgradeSystems: null,
  goldenFingers: null,
  antiPatterns: null,
  narrativePrinciples: null,
  mysterySubtypes: null,
  interactiveNarrativeTypes: null,
  gameNarrativeStructures: null,
  comicNarrativeTechniques: null,
  writingGuideRules: null,
  commentaryTechniques: null,
  oralNarrativeSkills: null,
};

export function reloadCatalog(): void {
  for (const key of Object.keys(cache) as Array<keyof CatalogCache>) {
    cache[key] = null;
  }
}

export function getSatisfactionPatterns(): Record<SatisfactionPattern, SatisfactionPatternDef> {
  if (!cache.satisfactionPatterns) {
    cache.satisfactionPatterns = loadJson('satisfaction-patterns.json') as Record<SatisfactionPattern, SatisfactionPatternDef>;
  }
  return cache.satisfactionPatterns;
}

function loadNarrativeTechniquesFile() {
  return loadJson('narrative-techniques.json') as {
    narrativeTechniques: Record<NarrativeTechnique, NarrativeTechniqueDef>;
    foreshadowHierarchy: ForeshadowHierarchyData;
    foreshadowRecoveryMethods: ForeshadowRecoveryMethodsData;
    subgenreRules: Record<SuspenseSubgenre, SubgenreRules>;
  };
}

export function getNarrativeTechniques(): Record<NarrativeTechnique, NarrativeTechniqueDef> {
  if (!cache.narrativeTechniques) {
    cache.narrativeTechniques = loadNarrativeTechniquesFile().narrativeTechniques;
  }
  return cache.narrativeTechniques;
}

export function getForeshadowHierarchy(): ForeshadowHierarchyData {
  if (!cache.foreshadowHierarchy) {
    cache.foreshadowHierarchy = loadNarrativeTechniquesFile().foreshadowHierarchy;
  }
  return cache.foreshadowHierarchy;
}

export function getForeshadowRecoveryMethods(): ForeshadowRecoveryMethodsData {
  if (!cache.foreshadowRecoveryMethods) {
    cache.foreshadowRecoveryMethods = loadNarrativeTechniquesFile().foreshadowRecoveryMethods;
  }
  return cache.foreshadowRecoveryMethods;
}

export function getSubgenreRules(): Record<SuspenseSubgenre, SubgenreRules> {
  if (!cache.subgenreRules) {
    cache.subgenreRules = loadNarrativeTechniquesFile().subgenreRules;
  }
  return cache.subgenreRules;
}

function loadGenreStructuresFile() {
  return loadJson('genre-structures.json') as {
    genreBeats: Record<GenreBeatType, GenreBeatTemplate>;
    storyStructures: StoryStructureData;
    dialogueRules: DialogueRulesData;
  };
}

export function getGenreBeats(): Record<GenreBeatType, GenreBeatTemplate> {
  if (!cache.genreBeats) {
    cache.genreBeats = loadGenreStructuresFile().genreBeats;
  }
  return cache.genreBeats;
}

export function getStoryStructures(): StoryStructureData {
  if (!cache.storyStructures) {
    cache.storyStructures = loadGenreStructuresFile().storyStructures;
  }
  return cache.storyStructures;
}

export function getDialogueRules(): DialogueRulesData {
  if (!cache.dialogueRules) {
    cache.dialogueRules = loadGenreStructuresFile().dialogueRules;
  }
  return cache.dialogueRules;
}

function loadWebNovelDataFile() {
  return loadJson('web-novel-data.json') as {
    webNovelPsychology: WebNovelPsychologyData;
    upgradeSystems: Record<UpgradeSystem, UpgradeSystemDef>;
    goldenFingers: Record<GoldenFingerType, GoldenFingerDef>;
  };
}

export function getWebNovelPsychology(): WebNovelPsychologyData {
  if (!cache.webNovelPsychology) {
    cache.webNovelPsychology = loadWebNovelDataFile().webNovelPsychology;
  }
  return cache.webNovelPsychology;
}

export function getUpgradeSystems(): Record<UpgradeSystem, UpgradeSystemDef> {
  if (!cache.upgradeSystems) {
    cache.upgradeSystems = loadWebNovelDataFile().upgradeSystems;
  }
  return cache.upgradeSystems;
}

export function getGoldenFingers(): Record<GoldenFingerType, GoldenFingerDef> {
  if (!cache.goldenFingers) {
    cache.goldenFingers = loadWebNovelDataFile().goldenFingers;
  }
  return cache.goldenFingers;
}

function loadWritingQualityFile() {
  return loadJson('writing-quality.json') as {
    antiPatterns: Record<AntiPattern, AntiPatternDef>;
    narrativePrinciples: Record<NarrativePrinciple, NarrativePrincipleDef>;
    mysterySubtypes: Record<MysterySubtype, MysterySubtypeDef>;
  };
}

export function getAntiPatterns(): Record<AntiPattern, AntiPatternDef> {
  if (!cache.antiPatterns) {
    cache.antiPatterns = loadWritingQualityFile().antiPatterns;
  }
  return cache.antiPatterns;
}

export function getNarrativePrinciples(): Record<NarrativePrinciple, NarrativePrincipleDef> {
  if (!cache.narrativePrinciples) {
    cache.narrativePrinciples = loadWritingQualityFile().narrativePrinciples;
  }
  return cache.narrativePrinciples;
}

export function getMysterySubtypes(): Record<MysterySubtype, MysterySubtypeDef> {
  if (!cache.mysterySubtypes) {
    cache.mysterySubtypes = loadWritingQualityFile().mysterySubtypes;
  }
  return cache.mysterySubtypes;
}

function loadExtendedCatalogsFile() {
  return loadJson('extended-catalogs.json') as {
    interactiveNarrativeTypes: Record<InteractiveNarrativeType, InteractiveNarrativeDef>;
    gameNarrativeStructures: Record<GameNarrativeStructure, GameNarrativeDef>;
    comicNarrativeTechniques: Record<ComicNarrativeTechnique, ComicNarrativeDef>;
    writingGuideRules: Record<WritingGuideRule, WritingGuideDef>;
    commentaryTechniques: Record<CommentaryTechnique, CommentaryDef>;
    oralNarrativeSkills: Record<OralNarrativeSkill, OralNarrativeDef>;
  };
}

export function getInteractiveNarrativeTypes(): Record<InteractiveNarrativeType, InteractiveNarrativeDef> {
  if (!cache.interactiveNarrativeTypes) {
    cache.interactiveNarrativeTypes = loadExtendedCatalogsFile().interactiveNarrativeTypes;
  }
  return cache.interactiveNarrativeTypes;
}

export function getGameNarrativeStructures(): Record<GameNarrativeStructure, GameNarrativeDef> {
  if (!cache.gameNarrativeStructures) {
    cache.gameNarrativeStructures = loadExtendedCatalogsFile().gameNarrativeStructures;
  }
  return cache.gameNarrativeStructures;
}

export function getComicNarrativeTechniques(): Record<ComicNarrativeTechnique, ComicNarrativeDef> {
  if (!cache.comicNarrativeTechniques) {
    cache.comicNarrativeTechniques = loadExtendedCatalogsFile().comicNarrativeTechniques;
  }
  return cache.comicNarrativeTechniques;
}

export function getWritingGuideRules(): Record<WritingGuideRule, WritingGuideDef> {
  if (!cache.writingGuideRules) {
    cache.writingGuideRules = loadExtendedCatalogsFile().writingGuideRules;
  }
  return cache.writingGuideRules;
}

export function getCommentaryTechniques(): Record<CommentaryTechnique, CommentaryDef> {
  if (!cache.commentaryTechniques) {
    cache.commentaryTechniques = loadExtendedCatalogsFile().commentaryTechniques;
  }
  return cache.commentaryTechniques;
}

export function getOralNarrativeSkills(): Record<OralNarrativeSkill, OralNarrativeDef> {
  if (!cache.oralNarrativeSkills) {
    cache.oralNarrativeSkills = loadExtendedCatalogsFile().oralNarrativeSkills;
  }
  return cache.oralNarrativeSkills;
}
