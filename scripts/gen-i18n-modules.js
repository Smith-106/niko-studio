const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '..', 'desktop', 'src', 'i18n', 'modules');
const transPath = path.join(__dirname, '..', 'desktop', 'src', 'i18n', 'translations.ts');
const content = fs.readFileSync(transPath, 'utf8');
const lines = content.split('\n');

let zhStart = -1, zhEnd = -1, enStart = -1, enEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/^\s*zh:\s*\{/)) zhStart = i;
  if (lines[i].match(/^\s*en:\s*\{/)) { enStart = i; zhEnd = i - 1; }
}
for (let i = lines.length - 1; i > enStart; i--) {
  if (lines[i].trim() === '},') { enEnd = i; break; }
}

function parseKVPairs(startLine, endLine) {
  const pairs = [];
  for (let i = startLine; i <= endLine; i++) {
    const line = lines[i];
    const match = line.match(/^\s{4}(\w+):\s*(.+?),?\s*$/);
    if (match) {
      let val = match[2];
      if (val.endsWith(',')) val = val.slice(0, -1);
      pairs.push({ key: match[1], value: val, line: i });
    }
  }
  return pairs;
}

const zhPairs = parseKVPairs(zhStart + 1, zhEnd);
const enPairs = parseKVPairs(enStart + 1, enEnd);
const zhMap = new Map(zhPairs.map(p => [p.key, p.value]));
const enMap = new Map(enPairs.map(p => [p.key, p.value]));

console.log('zh pairs:', zhPairs.length, 'en pairs:', enPairs.length);

// Exclusive key assignment using explicit lists (highest priority first)
const appKeys = [
  'appTitle','serviceRunning','serviceOffline','contextUsage','checkpoint','restore',
  'restoreSuccess','restoreSuccessWithCheckpoint','restoreFailed','loadingCheckpoints',
  'noCheckpoints','contextEstimated','nikoStudio','newChat','chatList','skillPacks',
  'knowledgeBase','settings','skipToMainContent','serviceDegraded','serviceReconnecting',
  'contextUsageLowHint','contextUsageMediumHint','contextUsageHighHint',
  'uiSettings','theme','themeLight','themeDark','themeSystem','themeSorbet','themeSlate',
  'themeAmber','themeForest','themeCharcoal','themeCauldron','themeAurora','themeMoonbeam',
  'themeSepia','fontSize','fontSmall','fontMedium','fontLarge','language','langChinese',
  'langEnglish','sendShortcutLabel','sendShortcutEnter','sendShortcutCtrlEnter',
  'resetDefault','cancel','save','exportSettings','importSettings','importSuccess',
  'importFailed','quickPanelTitle','quickPanelResultsLabel','quickPanelSearchPlaceholder',
  'quickPanelNoMatch','quickPanelSelect','quickPanelConfirm','quickPanelClose',
  'contentSearchPlaceholder','errorBoundaryTitle','errorBoundaryDescription',
  'errorBoundaryTryAgain','errorBoundaryReload','streamErrorCategory','scrollToBottom'
];

const editorKeys = [
  'sidebarNewDocument','sidebarContinueWriting','sidebarDocuments',
  'mcpMetricTotal','mcpMetricFailed','mcpMetricAvgLatency','mcpMetricMaxLatency',
  'editorWordCount','editorCharCount','editorReadingTime','editorAutoSaved',
  'editorPlaceholder','editorAiGenerating','editorAiCancel',
  'editorCmdGenerate','editorCmdGenerateDesc','editorCmdContinue','editorCmdContinueDesc',
  'editorCmdFullArticle','editorCmdFullArticleDesc',
  'editorCmdHeading1','editorCmdHeading1Desc','editorCmdHeading2','editorCmdHeading2Desc',
  'editorCmdHeading3','editorCmdHeading3Desc','editorCmdBulletList','editorCmdBulletListDesc',
  'editorCmdOrderedList','editorCmdOrderedListDesc','editorCmdBlockquote','editorCmdBlockquoteDesc',
  'editorCmdCodeBlock','editorCmdCodeBlockDesc','editorCmdHorizontalRule','editorCmdHorizontalRuleDesc',
  'editorBubbleBold','editorBubbleItalic','editorBubbleStrikethrough',
  'editorBubbleRewrite','editorBubblePolish','editorBubbleSimplify',
  'editorBubbleExpand','editorBubbleFormal','editorBubbleCasual',
  'editorBubbleSummarize','editorBubbleContinue',
  'exportMarkdown','exportHtml','exportPdf','exportDialogTitle','exportFilename',
  'exportFormat','exportButton','exportCancel','exportHistoryTitle','exportHistoryEmpty',
  'editorStatusSaving','editorStatusSavedAt','editorDraftRestored','editorDraftRestoredAt'
];

// Assign remaining keys by prefix, using exclusive sets
const assigned = new Set([...appKeys, ...editorKeys]);

// Chat: all chat/stream/inline/template/upload/rollback/mode/message/composer/starter keys
// EXCEPT those already assigned
const chatKeys = zhPairs.filter(p => {
  if (assigned.has(p.key)) return false;
  return p.key.startsWith('startWriting') || p.key.startsWith('chatStarter') ||
    p.key === 'thinking' || p.key === 'workflow' || p.key === 'quick' || p.key === 'lite' ||
    p.key === 'standard' || p.key === 'brainstorm' || p.key === 'coordinator' || p.key === 'planning' ||
    p.key === 'selectedSkills' || p.key === 'inputPlaceholder' ||
    p.key.startsWith('stream') || p.key.startsWith('inline') ||
    p.key.startsWith('template') || p.key === 'processingCompleted' ||
    p.key === 'serviceUnavailableRetry' || p.key === 'backendConnectionFailed' ||
    p.key === 'sessionCreateFailedRetry' || p.key.startsWith('upload') ||
    p.key === 'chatAgentContextPrefix' || p.key.startsWith('quickRollback') ||
    p.key.startsWith('chatMode') || p.key.startsWith('modePreset') ||
    p.key === 'showMore' || p.key === 'showLess' ||
    p.key.startsWith('chatComparison') || p.key.startsWith('messageBubble') ||
    p.key.startsWith('chatAgent') || p.key.startsWith('composer') ||
    p.key === 'voiceInputStatusLabel' ||
    p.key.startsWith('starter') || p.key.startsWith('writerContext') ||
    p.key === 'currentDocumentFallback';
}).map(p => p.key);
chatKeys.forEach(k => assigned.add(k));
// Evaluation: all evaluation/failure keys
const evaluationKeys = zhPairs.filter(p => {
  if (assigned.has(p.key)) return false;
  return p.key.startsWith('evaluation') || p.key.startsWith('failureCategory') || p.key.startsWith('failureMessage');
}).map(p => p.key);
evaluationKeys.forEach(k => assigned.add(k));

// Knowledge: knowledge/intelligence/foreshadow/pattern/session/evalDrill/charRel
const knowledgeKeys = zhPairs.filter(p => {
  if (assigned.has(p.key)) return false;
  return p.key.startsWith('knowledge') || p.key.startsWith('intelligence') ||
    p.key.startsWith('foreshadow') || p.key.startsWith('pattern') ||
    p.key.startsWith('session') || p.key.startsWith('evalDrill') ||
    p.key.startsWith('charRel');
}).map(p => p.key);
knowledgeKeys.forEach(k => assigned.add(k));

// Sidebar: sidebar/storyBible/aiTool/skill/writerWorkspace/writerStoryBible/writerChapter/writingHelper(panel)
const sidebarKeys = zhPairs.filter(p => {
  if (assigned.has(p.key)) return false;
  return p.key.startsWith('sidebarToggle') || p.key.startsWith('chatSidebarToggle') ||
    p.key.startsWith('storyBible') || p.key.startsWith('aiTool') ||
    p.key.startsWith('sidebarWritingHelper') || p.key.startsWith('sidebarMcpStatus') ||
    p.key.startsWith('sidebarEvaluationPanel') || p.key.startsWith('sidebarTextOptimizer') ||
    p.key.startsWith('skillGroup') || p.key.startsWith('skillDesc') ||
    p.key.startsWith('writerWorkspace') || p.key.startsWith('writerStoryBible') ||
    p.key.startsWith('writerChapter') ||
    p.key === 'writingHelperTitle' || p.key === 'writingHelperMode' ||
    (p.key.startsWith('writingHelperMode') && !p.key.startsWith('writingHelperModePrefix')) ||
    p.key === 'writingHelperMaxSentences' || p.key === 'writingHelperMaxItems' ||
    p.key === 'writingHelperInputText' || p.key === 'writingHelperInputPlaceholder';
}).map(p => p.key);
sidebarKeys.forEach(k => assigned.add(k));

// Settings: settings/backend/llm/multi/primary/test/api/base/default/setPrimary/model/temp/writing/workflow/target/auto/quality/writingHelper(settings)
const settingsKeys = zhPairs.filter(p => {
  if (assigned.has(p.key)) return false;
  return p.key.startsWith('settings') || p.key.startsWith('backendConfig') ||
    p.key === 'backendService' || p.key === 'backendUrl' ||
    p.key === 'llmConfig' || p.key === 'multiModel' || p.key === 'primary' ||
    p.key === 'testConnection' || p.key === 'testing' ||
    p.key === 'apiKey' || p.key === 'baseUrl' || p.key === 'defaultModel' ||
    p.key === 'setPrimary' || p.key === 'modelParams' ||
    p.key === 'temperature' || p.key === 'temperatureDesc' ||
    p.key === 'writingSettings' || p.key === 'defaultWorkflow' ||
    p.key.startsWith('workflowBackendMode') || p.key.startsWith('workflowL') ||
    p.key === 'targetWords' || p.key === 'autoSkillMatch' ||
    p.key.startsWith('qualityGoal') || p.key.startsWith('qualityPreset') ||
    p.key.startsWith('writingHelper');
}).map(p => p.key);
settingsKeys.forEach(k => assigned.add(k));

// Style: style/optimizerTwoStep
const styleKeys = zhPairs.filter(p => {
  if (assigned.has(p.key)) return false;
  return p.key.startsWith('style') || p.key === 'optimizerTwoStepMode' || p.key === 'optimizerTwoStepAnalysis';
}).map(p => p.key);
styleKeys.forEach(k => assigned.add(k));

// Optimizer: optimizer (except twoStep already in style)
const optimizerKeys = zhPairs.filter(p => {
  if (assigned.has(p.key)) return false;
  return p.key.startsWith('optimizer');
}).map(p => p.key);
optimizerKeys.forEach(k => assigned.add(k));

// MCP: mcp/runtime/packaged/embedding/parser/integration
const mcpKeys = zhPairs.filter(p => {
  if (assigned.has(p.key)) return false;
  return p.key.startsWith('mcp') || p.key.startsWith('runtime') ||
    p.key.startsWith('packaged') || p.key.startsWith('embedding') ||
    p.key.startsWith('parser') || p.key.startsWith('integration');
}).map(p => p.key);
mcpKeys.forEach(k => assigned.add(k));

// Check for unassigned
const allKeys = zhPairs.map(p => p.key);
const unassigned = allKeys.filter(k => !assigned.has(k));
console.log('Total:', allKeys.length, 'Assigned:', assigned.size, 'Unassigned:', unassigned.length);
if (unassigned.length > 0) console.log('Unassigned keys:', unassigned);

// Generate module files
function generateModuleFile(name, exportName, keys) {
  const typeLines = keys.map((k, i) => {
    const prefix = i === 0 ? '  ' : '  | ';
    return `${prefix}'${k}'`;
  });
  const zhLines = keys.map(k => `  ${k}: ${zhMap.get(k)},`);
  const enLines = keys.map(k => `  ${k}: ${enMap.get(k)},`);

  const fileContent = `import type { Translations } from '../translations'\n\ntype ${exportName}Keys =\n${typeLines.join('\n')}\n\nexport const zh${exportName}: Pick<Translations, ${exportName}Keys> = {\n${zhLines.join('\n')}\n}\n\nexport const en${exportName}: Pick<Translations, ${exportName}Keys> = {\n${enLines.join('\n')}\n}\n`;
  fs.writeFileSync(path.join(modulesDir, `${name}.ts`), fileContent, 'utf8');
  console.log(`  ${name}.ts: ${keys.length} keys`);
}

console.log('Generating modules:');
generateModuleFile('app', 'App', appKeys);
generateModuleFile('chat', 'Chat', chatKeys);
generateModuleFile('editor', 'Editor', editorKeys);
generateModuleFile('evaluation', 'Evaluation', evaluationKeys);
generateModuleFile('knowledge', 'Knowledge', knowledgeKeys);
generateModuleFile('sidebar', 'Sidebar', sidebarKeys);
generateModuleFile('settings', 'Settings', settingsKeys);
generateModuleFile('style', 'Style', styleKeys);
generateModuleFile('optimizer', 'Optimizer', optimizerKeys);
generateModuleFile('mcp', 'Mcp', mcpKeys);
console.log('Done!');
