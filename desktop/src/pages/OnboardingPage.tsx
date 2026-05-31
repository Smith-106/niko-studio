import { useState } from 'react'

const STEPS = ['欢迎', 'AI 模型', '知识层', '开始写作']

export default function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)

  return (
    <div className="flex items-center justify-center h-screen bg-zinc-900 text-zinc-100">
      <div className="w-[480px] space-y-6">
        {/* 进度条 */}
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-blue-500' : 'bg-zinc-800'}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">欢迎使用 niko-studio</h1>
            <p className="text-sm text-zinc-400">AI 驱动的写作工作站，开箱即用。</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-zinc-800 p-3">
                <div className="font-medium mb-1">多角色头脑风暴</div>
                <p className="text-zinc-500">8 位叙事专家并行分析，交叉审查发现矛盾和协同</p>
              </div>
              <div className="rounded-lg border border-zinc-800 p-3">
                <div className="font-medium mb-1">质量门禁</div>
                <p className="text-zinc-500">三级质量保障，对抗评分确保发布质量</p>
              </div>
              <div className="rounded-lg border border-zinc-800 p-3">
                <div className="font-medium mb-1">伏笔追踪</div>
                <p className="text-zinc-500">自动追踪埋设与回收，到期提醒不遗漏</p>
              </div>
              <div className="rounded-lg border border-zinc-800 p-3">
                <div className="font-medium mb-1">知识层集成</div>
                <p className="text-zinc-500">Nowledge Mem LLM Wiki，知识编译一次复用无数次</p>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">配置 AI 模型</h1>
            <p className="text-sm text-zinc-400">至少启用一个提供商即可使用。推荐 Ollama（免费本地运行）。</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 rounded-lg border border-zinc-800 p-3">
                <input type="radio" name="provider" defaultChecked />
                <div>
                  <div className="text-sm font-medium">Ollama（推荐）</div>
                  <div className="text-[10px] text-zinc-500">免费 · 本地运行 · 隐私优先</div>
                </div>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-zinc-800 p-3">
                <input type="radio" name="provider" />
                <div>
                  <div className="text-sm font-medium">OpenAI</div>
                  <div className="text-[10px] text-zinc-500">GPT-4o / o3 · 需 API Key</div>
                </div>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-zinc-800 p-3">
                <input type="radio" name="provider" />
                <div>
                  <div className="text-sm font-medium">Anthropic</div>
                  <div className="text-[10px] text-zinc-500">Claude Sonnet / Opus · 需 API Key</div>
                </div>
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">知识层</h1>
            <p className="text-sm text-zinc-400">Nowledge Mem 提供 LLM Wiki、记忆衰减、跨工具上下文。可稍后配置。</p>
            <label className="flex items-center gap-2 rounded-lg border border-zinc-800 p-3">
              <input type="checkbox" />
              <div>
                <div className="text-sm font-medium">启用 Nowledge Mem 集成</div>
                <div className="text-[10px] text-zinc-500">本地 127.0.0.1:19828 · 需单独安装</div>
              </div>
            </label>
            <p className="text-[10px] text-zinc-600">未启用时，写作核心功能仍可正常使用。</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-bold">准备就绪</h1>
            <p className="text-sm text-zinc-400">开始你的创作之旅吧。</p>
          </div>
        )}

        <div className="flex justify-between">
          <button onClick={() => setStep(Math.max(0, step - 1))}
            className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30"
            disabled={step === 0}>上一步</button>
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)}
              className="text-xs px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500">下一步</button>
          ) : (
            <button onClick={onComplete}
              className="text-xs px-4 py-1.5 rounded bg-green-600 hover:bg-green-500">进入工作台</button>
          )}
        </div>
      </div>
    </div>
  )
}
