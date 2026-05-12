export const gettingStartedContent: Record<string, string> = {
  installation: `
<h2>系统要求</h2>
<p>在正式安装前，建议先确认你的系统环境满足基础运行条件。普通用户只需要桌面安装包；开发者还需要 Node.js 和项目依赖。</p>
<ul>
  <li>Windows 10/11 (64-bit) 或 macOS 12+</li>
  <li>4GB 以上可用内存，建议 8GB 以上</li>
  <li>500MB 以上磁盘空间，若启用本地模型或缓存素材，建议预留更多空间</li>
  <li>Node.js 18+（仅开发模式需要）</li>
</ul>
<h2>安装方式</h2>
<h3>普通用户安装</h3>
<p>下载桌面安装包后按向导完成安装。首次启动时建议先检查默认工作目录和模型配置。</p>
<pre><code># Windows
niko-studio-setup-x.x.x.exe

# macOS
niko-studio-x.x.x.dmg</code></pre>
<h3>开发者安装</h3>
<pre><code>git clone https://github.com/Smith-106/niko-studio.git
cd niko-studio/desktop
npm ci
npm run dev</code></pre>
<h2>验证安装</h2>
<p>安装成功后，你应该能看到项目区、编辑器、写作智能面板和设置入口。能创建项目并打开文档，即代表基础安装完成。</p>
<h2>常见问题</h2>
<ul>
  <li><strong>应用无法启动</strong> — 检查系统版本、安装包架构和安全策略。</li>
  <li><strong>依赖安装失败</strong> — 开发模式优先使用 <code>npm ci</code>。</li>
  <li><strong>AI 能力不可用</strong> — 检查模型配置、网络和 Gateway 服务状态。</li>
</ul>
  `,
  quickstart: `
<h2>5 分钟快速上手</h2>
<p>快速上手的目标是完成从创建项目到第一次获得分析结果的闭环。</p>
<h2>第 1 步：创建项目</h2>
<p>项目通常对应一本书、一个长篇故事或一组短篇。建议使用作品名作为项目名，便于后续检索和同步。</p>
<ul>
  <li>长篇作品建议先规划章节结构。</li>
  <li>试用功能时可以创建独立测试项目。</li>
  <li>项目目录不要放在临时路径中。</li>
</ul>
<h2>第 2 步：导入内容</h2>
<p>你可以从空白文档开始，也可以导入已有文本。</p>
<ul>
  <li><code>.txt</code> — 纯文本</li>
  <li><code>.md</code> — Markdown</li>
  <li><code>.docx</code> — Word 文档</li>
</ul>
<h2>第 3 步：执行第一次分析</h2>
<p>在编辑器中输入或粘贴文本后，点击分析按钮。第一次分析建议重点关注维度分数、文本证据和可执行建议。</p>
<h2>第 4 步：根据建议修订</h2>
<ol>
  <li>选择一个最明显的问题维度。</li>
  <li>阅读系统给出的证据。</li>
  <li>修改原文后重新分析，比较结果变化。</li>
</ol>
<h2>下一步推荐</h2>
<ul>
  <li>阅读「配置说明」调整模型和偏好。</li>
  <li>阅读「写作技法分析」理解分析维度。</li>
  <li>阅读「写作面板」理解结果展示。</li>
</ul>
  `,
  configuration: `
<h2>应用设置概览</h2>
<p>设置页用于配置模型接入、分析偏好、存储行为和同步策略。合理配置后，分析结果会更贴近你的写作目标。</p>
<h2>LLM 配置</h2>
<ul>
  <li><strong>本地模型</strong> — 适合隐私敏感场景。</li>
  <li><strong>OpenAI API</strong> — 适合通用分析和生成任务。</li>
  <li><strong>Anthropic API</strong> — 适合长上下文理解和结构化修订。</li>
</ul>
<h2>分析偏好</h2>
<p>你可以配置默认分析维度、评分方式和建议风格，以适配文学小说、网文、剧本或非虚构文本。</p>
<ul>
  <li>选择默认分析模板。</li>
  <li>设置是否突出问题项。</li>
  <li>调整建议风格为简洁或细致。</li>
</ul>
<h2>存储与缓存</h2>
<p>分析结果会缓存在本地，以减少重复调用成本。建议定期清理旧项目缓存，并确认素材和配置文件的存储路径。</p>
  `,
};
