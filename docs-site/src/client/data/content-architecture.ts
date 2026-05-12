export const architectureContent: Record<string, string> = {
  'system-overview': `
<h2>系统架构概览</h2>
<p>Niko Studio 采用前后端分离的桌面应用架构，组合桌面壳、服务能力和结构化分析引擎。</p>
<h2>技术栈</h2>
<ul>
  <li>Tauri 2.x。</li>
  <li>React + TypeScript + Vite。</li>
  <li>Node.js Gateway。</li>
  <li>Knowledge Engine / Analysis Engine。</li>
</ul>
<pre><code>Desktop Shell
  → Frontend
  → Gateway
  → Knowledge / Analysis
  → LLM Providers / Local Storage</code></pre>
  `,
  'module-design': `
<h2>模块设计</h2>
<p>系统按职责划分为前端、Gateway、知识引擎、分析引擎和插件层。</p>
<h2>前端模块</h2>
<ul>
  <li><code>components/</code> — UI 组件。</li>
  <li><code>stores/</code> — 状态管理。</li>
  <li><code>services/</code> — API 调用层。</li>
</ul>
<h2>后端模块</h2>
<ul>
  <li><code>knowledge/</code> — 知识引擎。</li>
  <li><code>analysis/</code> — 文本分析管道。</li>
  <li><code>mcp/</code> — MCP 服务端。</li>
</ul>
  `,
  'data-flow': `
<h2>数据流</h2>
<p>数据流描述文本从用户输入到分析结果展示的路径。</p>
<pre><code>用户输入文本
  → 前端 Store 更新
  → API Service 调用
  → Gateway 路由
  → Knowledge Engine 上下文注入
  → LLM Provider 分析
  → 结构化结果返回
  → UI 渲染分析面板</code></pre>
  `,
};
