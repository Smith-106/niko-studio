export const syncContent: Record<string, string> = {
  'sync-overview': `
<h2>同步概览</h2>
<p>云同步让创作进度、分析结果和关键上下文可以在多设备间连续衔接。</p>
<h2>同步范围</h2>
<ul>
  <li>项目文件和元数据。</li>
  <li>分析结果和缓存。</li>
  <li>知识库和设定。</li>
  <li>用户配置和偏好。</li>
</ul>
<h2>同步策略</h2>
<p>采用增量同步，仅传输变更部分，减少同步时间。</p>
  `,
  'push-pull': `
<h2>推送与拉取</h2>
<p>推送与拉取用于手动控制同步方向。</p>
<ul>
  <li><strong>推送</strong> — 将本地变更上传到云端。</li>
  <li><strong>拉取</strong> — 从云端下载变更。</li>
  <li><strong>全量同步</strong> — 完整双向同步。</li>
</ul>
<h2>冲突解决</h2>
<p>检测到冲突时，可以保留本地、保留远程或手动合并。</p>
<h3>端点</h3>
<pre><code>GET  /sync/status
POST /sync/push
POST /sync/pull
POST /sync/full</code></pre>
  `,
};
