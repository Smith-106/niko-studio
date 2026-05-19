import { releaseSnapshotMiniSection } from './shared-doc-fragments';

export const gettingStartedContent: Record<string, string> = {
  installation: `
<h2>安装前先理解运行形态</h2>
<p>Niko Studio 是 writer-first desktop studio。普通写作者面对的是桌面应用；开发者看到的是 Tauri 桌面壳、React 前端和本地 Node.js Gateway 组成的运行栈。</p>
<pre><code>flowchart LR
  User[写作者] --> Desktop[桌面应用]
  Desktop --> Frontend[React 编辑器与面板]
  Frontend --> Gateway[本地 Gateway]
  Gateway --> Storage[本地作品与缓存]
  Gateway --> Model[LLM / 本地模型]</code></pre>
<h2>系统要求</h2>
<p>普通用户只需要桌面安装包；开发者运行源码时需要额外准备 Node.js、Rust 和项目依赖。</p>
<table>
  <thead><tr><th>场景</th><th>需要准备</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>日常写作</td><td>Windows 10/11 64-bit 或 macOS 12+</td><td>安装桌面包后即可进入编辑器。</td></tr>
    <tr><td>AI 分析</td><td>可用模型配置</td><td>可接入云端模型，也可使用本地模型方案。</td></tr>
    <tr><td>开发调试</td><td>Node.js 18+、Rust、npm 依赖</td><td>用于启动前端、Tauri host 和 Gateway。</td></tr>
    <tr><td>大型项目</td><td>8GB 以上内存、更多磁盘空间</td><td>素材索引、分析缓存和本地模型会占用额外空间。</td></tr>
  </tbody>
</table>
<h2>普通用户安装</h2>
<p>下载桌面安装包后按向导安装。首次启动时优先确认工作目录、模型配置和本地服务状态。</p>
<pre><code># Windows
niko-studio-setup-x.x.x.exe

# macOS
niko-studio-x.x.x.dmg</code></pre>
${releaseSnapshotMiniSection}
<h2>开发者启动</h2>
<p>源码运行时以桌面目录为入口，依赖安装建议使用锁文件驱动的 <code>npm ci</code>，避免开发环境漂移。</p>
<pre><code>git clone https://github.com/Smith-106/niko-studio.git
cd niko-studio/desktop
npm ci
npm run dev</code></pre>
<h2>安装验收清单</h2>
<ul>
  <li>能打开桌面主窗口，并看到项目区、正文编辑器和右侧写作面板。</li>
  <li>能创建或打开一个作品项目。</li>
  <li>能输入正文并保存到本地工作区。</li>
  <li>能访问设置页并看到模型、存储或 Gateway 状态。</li>
</ul>
<p>常见问题 启动失败先检查系统版本、安装包架构和安全策略；AI 能力不可用时先看模型配置和 Gateway 健康检查。</p>
  `,
  quickstart: `
<h2>5 分钟快速上手</h2>
<p>快速上手的目标不是读完整个文档站，而是完成一个可见闭环：创建作品、写入正文、触发分析、根据建议修订。</p>
<pre><code>flowchart TD
  A[创建作品项目] --> B[新建或导入文档]
  B --> C[在编辑器中写作]
  C --> D[选择 AI 意图或分析维度]
  D --> E[查看右侧面板证据]
  E --> F[回到正文修订]
  F --> G[重新分析或导出]</code></pre>
<h2>第 1 步：创建项目</h2>
<p>项目通常对应一本书、一个长篇故事或一组短篇。建议使用作品名作为项目名，让素材、角色、世界观和分析缓存都围绕同一个工作区组织。</p>
<ul>
  <li>长篇作品建议先创建章节结构。</li>
  <li>试用功能时可以创建独立测试项目。</li>
  <li>项目目录不要放在系统临时路径中。</li>
</ul>
<h2>第 2 步：写入或导入内容</h2>
<p>你可以从空白文档开始，也可以导入已有文本。导入后先通读正文，确认章节边界、标题和段落没有被破坏。</p>
<table>
  <thead><tr><th>输入方式</th><th>适合场景</th><th>建议</th></tr></thead>
  <tbody>
    <tr><td>空白文档</td><td>新作品、新章节</td><td>先写目标、冲突和转折，再请求扩写。</td></tr>
    <tr><td><code>.txt</code> / <code>.md</code></td><td>已有草稿迁移</td><td>保持章节标题清晰，便于后续分析。</td></tr>
    <tr><td><code>.docx</code></td><td>Word 草稿</td><td>导入后检查格式和段落顺序。</td></tr>
  </tbody>
</table>
<h2>第 3 步：执行第一次分析</h2>
<p>第一次分析建议只关注 1 到 2 个最重要的问题：例如叙事结构是否清楚、角色动机是否成立、场景冲突是否足够。不要同时接受所有建议。</p>
<h2>第 4 步：根据证据修订</h2>
<ol>
  <li>选择一个分数最低或最影响阅读的问题维度。</li>
  <li>阅读系统给出的文本证据，而不是只看结论。</li>
  <li>修改原文后重新分析，比较分数、证据和建议变化。</li>
</ol>
<h2>下一步推荐</h2>
<ul>
  <li>阅读「写作面板」理解右侧面板如何组织结果。</li>
  <li>阅读「写作技法分析」理解系统为什么给出这些判断。</li>
  <li>阅读「系统概览」理解桌面应用、Gateway、知识引擎之间的关系。</li>
</ul>
  `,
  configuration: `
<h2>配置说明</h2>
<p>配置的目标是让 Niko Studio 知道三件事：作品放在哪里、模型如何调用、分析结果应该按什么偏好呈现。</p>
<pre><code>flowchart LR
  Settings[设置页] --> Config[本地配置]
  Config --> Gateway[Gateway 读取]
  Gateway --> Model[模型提供方]
  Gateway --> Cache[分析缓存]
  Gateway --> Workspace[当前作品工作区]</code></pre>
<h2>LLM 配置</h2>
<ul>
  <li><strong>云端模型</strong> — 适合长上下文理解、结构化修订和高质量生成。</li>
  <li><strong>本地模型</strong> — 适合隐私敏感或离线优先场景。</li>
  <li><strong>Gateway 配置</strong> — 负责统一封装模型、流式输出、错误状态和工具列表。</li>
</ul>
<h2>分析偏好</h2>
<p>分析偏好决定系统把注意力放在哪里。文学小说可以更重视叙事视角和语言质感；网文可以更重视节奏、爽点、钩子和追读动力。</p>
<ul>
  <li>选择默认分析模板和重点维度。</li>
  <li>设置建议风格：简洁提示、详细解释或可执行改写。</li>
  <li>控制是否突出问题项、证据片段和优先级。</li>
</ul>
<h2>存储与缓存</h2>
<p>作品文本、素材索引、分析缓存和偏好配置默认围绕本地工作区组织。清理缓存不会替代备份，重要作品仍建议使用外部备份策略。</p>
<h2>排查顺序</h2>
<ol>
  <li>先确认桌面应用能打开当前工作区。</li>
  <li>再检查 <code>GET /health</code>、<code>GET /models</code> 等 Gateway 状态。</li>
  <li>最后检查模型密钥、网络代理或本地模型服务。</li>
</ol>
  `,
};
