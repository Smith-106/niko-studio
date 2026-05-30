export type Language = 'zh' | 'en'

import type { Translations as AppTranslations } from './modules/app'
import type { Translations as SidebarTranslations } from './modules/sidebar'
import type { Translations as ChatTranslations } from './modules/chat'
import type { Translations as EditorTranslations } from './modules/editor'
import type { Translations as KnowledgeTranslations } from './modules/knowledge'
import type { Translations as EvaluationTranslations } from './modules/evaluation'
import type { Translations as SettingsTranslations } from './modules/settings'
import type { Translations as StyleTranslations } from './modules/style'
import type { Translations as OptimizerTranslations } from './modules/optimizer'
import type { Translations as McpTranslations } from './modules/mcp'
import type { Translations as WelcomeTranslations } from './modules/welcome'
import type { Translations as WorkflowTranslations } from './modules/workflow'

export type Translations = AppTranslations &
  SidebarTranslations &
  ChatTranslations &
  EditorTranslations &
  KnowledgeTranslations &
  EvaluationTranslations &
  SettingsTranslations &
  StyleTranslations &
  OptimizerTranslations &
  McpTranslations &
  WelcomeTranslations &
  WorkflowTranslations

import {
  zhApp, enApp,
  zhChat, enChat,
  zhEditor, enEditor,
  zhEvaluation, enEvaluation,
  zhKnowledge, enKnowledge,
  zhSidebar, enSidebar,
  zhSettings, enSettings,
  zhStyle, enStyle,
  zhOptimizer, enOptimizer,
  zhMcp, enMcp,
  zhWelcome, enWelcome,
  zhWorkflow, enWorkflow,
} from './modules'

export const translations: Record<Language, Translations> = {
  zh: {
    ...zhApp,
    ...zhChat,
    ...zhEditor,
    ...zhEvaluation,
    ...zhKnowledge,
    ...zhSidebar,
    ...zhSettings,
    ...zhStyle,
    ...zhOptimizer,
    ...zhMcp,
    ...zhWelcome,
    ...zhWorkflow,
  },
  en: {
    ...enApp,
    ...enChat,
    ...enEditor,
    ...enEvaluation,
    ...enKnowledge,
    ...enSidebar,
    ...enSettings,
    ...enStyle,
    ...enOptimizer,
    ...enMcp,
    ...enWelcome,
    ...enWorkflow,
  },
}
