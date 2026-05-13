export const syncContent: Record<string, string> = {
  'sync-overview': `
<h2>同步概览</h2>
<p>云同步目前是 roadmap 页面，用于记录未来多设备连续创作的设计方向，不属于当前 shipped surface。当前可交付能力以 <code>docs/CAPABILITY_MATRIX.md</code> 为准。</p>
<h2>预期同步范围</h2>
<ul>
  <li>项目文件和元数据。</li>
  <li>分析结果和缓存。</li>
  <li>知识库和设定。</li>
  <li>用户配置和偏好。</li>
</ul>
<h2>设计目标图</h2>
<pre><code>flowchart LR
  DeviceA[设备 A 工作区] --> Push[Push]
  Push --> Remote[远端存储]
  Remote --> Pull[Pull]
  Pull --> DeviceB[设备 B 工作区]
  DeviceA --> Canon[Wiki / Canon]
  DeviceB --> Canon</code></pre>
<h2>状态边界</h2>
<p>在能力矩阵升级前，本页不承诺云端服务、增量同步、冲突合并或多设备自动恢复已经可用。需要跨设备迁移时，应使用当前桌面应用和工作区文件的受控备份路径。</p>
<h2>当前可执行替代路径</h2>
<ol>
  <li>把 workspace、素材和 Wiki 目录做受控备份。</li>
  <li>在另一台机器恢复工作区后，重建缓存和局部索引。</li>
  <li>不要把缓存或临时运行状态误认为必须严格同步的主数据。</li>
</ol>
  `,
  'push-pull': `
<h2>推送与拉取</h2>
<p>推送与拉取是云同步 roadmap 的交互草案，用于说明未来可能的手动同步方向；当前发布版本不提供稳定同步端点。</p>
<ul>
  <li><strong>推送</strong> — 计划用于将本地变更上传到云端。</li>
  <li><strong>拉取</strong> — 计划用于从云端下载变更。</li>
  <li><strong>全量同步</strong> — 计划用于完整双向同步。</li>
</ul>
<h2>未来应解决的问题</h2>
<table>
  <thead><tr><th>问题</th><th>为什么重要</th></tr></thead>
  <tbody>
    <tr><td>正文冲突</td><td>正文是主数据，不能被静默覆盖。</td></tr>
    <tr><td>Wiki / canon 冲突</td><td>会直接影响后续 Agent 与分析结果。</td></tr>
    <tr><td>缓存是否同步</td><td>决定同步成本与恢复速度。</td></tr>
    <tr><td>配置作用域</td><td>要区分用户级偏好与项目级设置。</td></tr>
  </tbody>
</table>
<h2>冲突解决</h2>
<p>冲突解决策略仍需随同步实现一起验证。发布前不能把保留本地、保留远程或手动合并写成已支持能力。</p>
<h3>端点状态</h3>
<p>同步 API 尚未列入当前能力矩阵的 supported 或 partial 范围；集成者不要依赖 <code>/sync/*</code> 作为稳定接口。</p>
<h2>文档解读规则</h2>
<p>只要本页仍标记为 <code>Roadmap</code>，这里的流程图和交互说明就只能当设计意图，不是当前交付承诺。对外说明多设备协作时，应明确这是未来方向，而不是现成功能。</p>
  `,
};
