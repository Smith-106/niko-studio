import React, { useState, useCallback } from 'react'
import { Eye, EyeOff, Sparkles, PenLine, Rocket } from 'lucide-react'
import { useI18n } from '../i18n'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { NOVEL_TEMPLATES, type NovelTemplate } from '../services/templates/novelTemplates'

interface WelcomeWizardProps {
  onComplete: () => void
}

type Step = 1 | 2 | 3

const STEP_ICONS: Record<Step, React.ReactNode> = {
  1: <Sparkles size={20} />,
  2: <PenLine size={20} />,
  3: <Rocket size={20} />,
}

export function WelcomeWizard({ onComplete }: WelcomeWizardProps) {
  const { t, language } = useI18n()
  const [step, setStep] = useState<Step>(1)
  const [projectName, setProjectName] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<NovelTemplate | null>(null)

  const providers = useSettingsStore((s) => s.settings.llmProviders)
  const updateProvider = useSettingsStore((s) => s.updateProvider)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const createNewProject = useAppStore((s) => s.createNewProject)
  const createNewProjectFromTemplate = useAppStore((s) => s.createNewProjectFromTemplate)
  const selectProject = useAppStore((s) => s.selectProject)

  const handleCreateProject = useCallback(() => {
    if (selectedTemplate) {
      const projectId = createNewProjectFromTemplate(selectedTemplate)
      selectProject(projectId)
      setSelectedTemplate(null)
      setStep(2)
      return
    }
    if (!projectName.trim()) return
    const projectId = createNewProject(projectName.trim())
    selectProject(projectId)
    setStep(2)
  }, [projectName, selectedTemplate, createNewProject, createNewProjectFromTemplate, selectProject])

  const handleSaveApiKey = useCallback(() => {
    if (selectedProvider && apiKey.trim()) {
      updateProvider(selectedProvider, {
        enabled: true,
        apiKey: apiKey.trim(),
      })
      updateSettings({ primaryProvider: selectedProvider })
    }
    setStep(3)
  }, [selectedProvider, apiKey, updateProvider, updateSettings])

  const handleSkipApiKey = useCallback(() => {
    setStep(3)
  }, [])

  const handleStartWriting = useCallback(() => {
    onComplete()
  }, [onComplete])

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-dark-bg rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 py-5 bg-slate-50 dark:bg-dark-surface/80">
          {([1, 2, 3] as Step[]).map((s) => (
            <div
              key={s}
              className={`flex items-center gap-1.5 transition-all duration-300 ${
                s === step
                  ? 'text-primary-600 dark:text-primary-400 scale-105'
                  : s < step
                    ? 'text-green-500'
                    : 'text-gray-400 dark:text-dark-text-secondary'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  s === step
                    ? 'bg-primary-600 text-white shadow-md'
                    : s < step
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 dark:bg-dark-surface2 text-gray-400 dark:text-dark-text-secondary'
                }`}
              >
                {s < step ? <span className="text-sm">&#10003;</span> : STEP_ICONS[s]}
              </div>
              <span className="text-xs font-medium hidden sm:inline">
                {s === 1 ? t.welcomeStepCreateProject : s === 2 ? t.welcomeStepConfigureAI : t.welcomeStepStartWriting}
              </span>
              {s < 3 && (
                <div
                  className={`w-6 h-0.5 mx-1 transition-colors duration-300 ${
                    s < step ? 'bg-green-500' : 'bg-gray-200 dark:bg-dark-surface2'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 px-8 py-6 min-h-[280px]">
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 dark:text-dark-text">{t.welcomeTitle}</h2>
                <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-2">{t.welcomeStepCreateProject}</p>
              </div>
              <div>
                <label htmlFor="welcome-project-name" className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  {t.welcomeProjectNameLabel}
                </label>
                <input
                  id="welcome-project-name"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={t.welcomeProjectNamePlaceholder}
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                />
              </div>

              {/* Template selection */}
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">
                  {t.welcomeCreateFromTemplate}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {NOVEL_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplate(selectedTemplate?.id === template.id ? null : template)
                        setProjectName('')
                      }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${
                        selectedTemplate?.id === template.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md scale-[1.02]'
                          : 'border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm'
                      }`}
                    >
                      <span className="text-2xl">{template.icon}</span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-dark-text">
                        {language === 'zh' ? template.nameZh : template.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-dark-text-secondary text-center leading-relaxed line-clamp-3">
                        {language === 'zh' ? template.descriptionZh : template.description}
                      </span>
                      <div className="flex gap-1 text-xs text-gray-400 dark:text-dark-text-muted">
                        <span>{template.characters.length} {t.welcomeTemplateChars}</span>
                        <span>{template.chapterOutlines.length} {t.welcomeTemplateChapters}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {selectedTemplate && (
                  <p className="mt-2 text-xs text-primary-600 dark:text-primary-400 text-center">
                    {t.welcomeTemplateSelectedHint
                      .replace('{name}', language === 'zh' ? selectedTemplate.nameZh : selectedTemplate.name)
                      .replace('{chars}', String(selectedTemplate.characters.length))
                      .replace('{chapters}', String(selectedTemplate.chapterOutlines.length))}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleCreateProject}
                disabled={!projectName.trim() && !selectedTemplate}
                className="w-full px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-500 shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {t.welcomeCreateProject}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 dark:text-dark-text">{t.welcomeStepConfigureAI}</h2>
                <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-2">{t.welcomeAIExplanation}</p>
              </div>
              <div>
                <label htmlFor="welcome-provider" className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  {t.welcomeProviderLabel}
                </label>
                <select
                  id="welcome-provider"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                >
                  <option value="">--</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {selectedProvider && (
                <div>
                  <label htmlFor="welcome-api-key" className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                    {t.welcomeApiKeyLabel}
                  </label>
                  <div className="relative">
                    <input
                      id="welcome-api-key"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={t.welcomeApiKeyPlaceholder}
                      className="w-full px-4 py-3 pr-10 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  disabled={!selectedProvider || !apiKey.trim()}
                  className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-500 shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {t.welcomeSaveAndContinue}
                </button>
                <button
                  type="button"
                  onClick={handleSkipApiKey}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-dark-surface2 text-gray-700 dark:text-dark-text rounded-xl hover:bg-gray-200 dark:hover:bg-dark-border transition-all font-medium"
                >
                  {t.welcomeSkipAI}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                  <Rocket size={28} className="text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-dark-text">{t.welcomeAllSetTitle}</h2>
                <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-2">{t.welcomeAllSetDescription}</p>
              </div>
              <div className="bg-slate-50 dark:bg-dark-surface rounded-xl p-4 space-y-3 border border-gray-100 dark:border-dark-border">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400 text-xs font-bold">/</span>
                  <span className="text-sm text-gray-600 dark:text-dark-text-secondary">{t.welcomeTipSlash}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400 text-xs font-bold">S</span>
                  <span className="text-sm text-gray-600 dark:text-dark-text-secondary">{t.welcomeTipSave}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400 text-xs font-bold">?</span>
                  <span className="text-sm text-gray-600 dark:text-dark-text-secondary">{t.welcomeTipShortcuts}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartWriting}
                className="w-full px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-500 shadow-md active:scale-95 transition-all font-medium"
              >
                {t.welcomeStartWriting}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}