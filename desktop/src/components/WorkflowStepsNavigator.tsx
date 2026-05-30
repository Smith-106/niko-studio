import React from 'react'
import { Brain, Scaling, Eye, Activity, Check, ChevronRight } from 'lucide-react'

import { useI18n } from '../i18n'

export type FlowStep = 1 | 2 | 3 | 4

interface WorkflowStepsNavigatorProps {
  activeRightPanel: string | undefined
  onOpenPanel: (panelId: string) => void
}

const STEP_CONFIG = {
  1: {
    titleKey: 'sidebarFlowWrite',
    defaultTitle: '写作与评估',
    subtitle: '智能分析 / 深度评估',
    icon: Brain,
    defaultPanel: 'analysis',
    associatedPanels: ['analysis', 'evaluation'],
  },
  2: {
    titleKey: 'sidebarFlowEvaluate',
    defaultTitle: '评估与修订',
    subtitle: '指标细分 / 模式诊断',
    icon: Scaling,
    defaultPanel: 'evaluationDrillDown',
    associatedPanels: ['evaluationDrillDown', 'patternDashboard'],
  },
  3: {
    titleKey: 'sidebarFlowRevise',
    defaultTitle: '修订与追踪',
    subtitle: '伏笔梳理 / 角色关系',
    icon: Eye,
    defaultPanel: 'foreshadowingTracker',
    associatedPanels: ['foreshadowingTracker', 'characterRelationships'],
  },
  4: {
    titleKey: 'sidebarFlowTrack',
    defaultTitle: '叙事追踪',
    subtitle: '叙事可视化 / 会话分析',
    icon: Activity,
    defaultPanel: 'narrativeVisualization',
    associatedPanels: ['narrativeVisualization', 'sessionAnalytics'],
  },
}

export function WorkflowStepsNavigator({
  activeRightPanel,
  onOpenPanel,
}: WorkflowStepsNavigatorProps) {
  const { t } = useI18n()

  const activeStep = React.useMemo<FlowStep | null>(() => {
    if (!activeRightPanel || activeRightPanel === 'none') return null
    for (const [step, config] of Object.entries(STEP_CONFIG)) {
      if (config.associatedPanels.includes(activeRightPanel)) {
        return Number(step) as FlowStep
      }
    }
    return null
  }, [activeRightPanel])

  const handleStepClick = (step: FlowStep) => {
    const config = STEP_CONFIG[step]
    onOpenPanel(config.defaultPanel)
  }

  const getStepTitle = (step: FlowStep) => {
    const config = STEP_CONFIG[step]
    if (!t) return config.defaultTitle
    // Try translating from i18n
    const key = config.titleKey as keyof typeof t
    return t[key] || config.defaultTitle
  }

  return (
    <div className="px-6 py-4 border-b border-gray-200/80 dark:border-dark-border/80 bg-white/70 dark:bg-dark-surface/60 backdrop-blur-md flex items-center justify-between gap-4 select-none shrink-0 z-10 transition-all">
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse-subtle shadow-[0_0_8px_rgba(114,64,221,0.6)]" />
        <span className="text-[10px] font-black text-gray-500 dark:text-dark-text-muted uppercase tracking-[0.2em] font-sans">
          写作智慧流
        </span>
      </div>

      <div className="flex-1 flex items-center justify-between max-w-4xl mx-auto relative px-2">
        {/* Progress Background Connector Line */}
        <div className="absolute top-[21px] left-10 right-10 h-[2px] bg-slate-200/80 dark:bg-dark-border/50 z-0 pointer-events-none rounded-full" />
        
        {/* Dynamic Highlight Line */}
        <div 
          className="absolute top-[21px] left-10 h-[2px] bg-gradient-to-r from-primary-500 to-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.65)] transition-all duration-500 ease-out z-0 pointer-events-none rounded-full"
          style={{
            width: activeStep === null ? '0%' : `${((activeStep - 1) / 3) * 100}%`,
            opacity: activeStep === null ? 0 : 1
          }}
        />

        {(Object.keys(STEP_CONFIG) as unknown as Array<keyof typeof STEP_CONFIG>).map((stepKey) => {
          const step = Number(stepKey) as FlowStep
          const config = STEP_CONFIG[step]
          const StepIcon = config.icon
          
          const isActive = activeStep === step
          const isCompleted = activeStep !== null && activeStep > step

          return (
            <div 
              key={step} 
              className="flex flex-col items-center group relative z-10 cursor-pointer"
              onClick={() => handleStepClick(step)}
            >
              {/* Step Circle Bubble */}
              <div 
                className={`w-[42px] h-[42px] rounded-2xl flex items-center justify-center transition-all duration-300 transform group-hover:scale-105 active:scale-95 border shadow-[var(--shadow-tiny)] ${
                  isActive 
                    ? 'bg-gradient-to-br from-primary-600 to-indigo-600 border-primary-500 text-white glow-primary rotate-[-4deg]' 
                    : isCompleted 
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 glow-emerald' 
                    : 'bg-white dark:bg-dark-bg border-slate-200 dark:border-dark-border text-slate-400 dark:text-dark-text-secondary hover:border-slate-300 dark:hover:border-dark-border2 hover:text-slate-600 dark:hover:text-dark-text'
                }`}
              >
                {isCompleted ? (
                  <Check size={18} strokeWidth={3.5} className="animate-fade-in" />
                ) : (
                  <StepIcon size={18} className={isActive ? 'animate-glow-pulse' : ''} />
                )}
              </div>

              {/* Title & Info Container */}
              <div className="mt-2.5 text-center flex flex-col items-center max-w-[130px]">
                <span className={`text-[10px] font-black tracking-wide transition-colors duration-300 ${
                  isActive 
                    ? 'text-primary-600 dark:text-primary-400' 
                    : isCompleted 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-slate-400 dark:text-dark-text-secondary group-hover:text-slate-600 dark:group-hover:text-dark-text'
                }`}>
                  {getStepTitle(step)}
                </span>
                <span className="text-[8px] font-bold text-slate-400 dark:text-dark-text-muted mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 truncate max-w-full">
                  {config.subtitle}
                </span>
              </div>

              {/* Floating Tooltip info card */}
              <div className="absolute bottom-full mb-3.5 px-3.5 py-2.5 glass-panel border text-gray-800 dark:text-white rounded-2xl shadow-[var(--shadow-card)] text-[10px] w-52 text-center opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-300 transform translate-y-1.5 group-hover:translate-y-0 flex flex-col gap-1.5 z-30">
                <div className="font-extrabold border-b border-gray-200/60 dark:border-white/10 pb-1 mb-0.5 text-primary-500 dark:text-primary-400 flex items-center justify-center gap-1">
                  <span>步骤 {step}</span>
                  <ChevronRight size={10} />
                  <span>{getStepTitle(step)}</span>
                </div>
                <div className="text-gray-600 dark:text-dark-text-secondary leading-relaxed font-sans font-medium">{config.subtitle}</div>
                <div className="text-[7.5px] text-gray-400 dark:text-dark-text-muted mt-1.5 uppercase tracking-wider font-extrabold">点击快速定位工具</div>
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="w-20 shrink-0" /> {/* Spacer balancing status badge */}
    </div>
  )
}
