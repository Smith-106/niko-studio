export { type WritingPlugin, type PluginResult, pluginEngine } from './plugin-engine';
export { rhythmChecker } from './builtins/rhythm-checker';
export { styleConsistency } from './builtins/style-consistency';

import { pluginEngine } from './plugin-engine';
import { rhythmChecker } from './builtins/rhythm-checker';
import { styleConsistency } from './builtins/style-consistency';

pluginEngine.register(rhythmChecker);
pluginEngine.register(styleConsistency);
