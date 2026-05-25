/**
 * 轻量级稳定哈希/序列化，替代 JSON.stringify 作为 memo/cache/搜索键
 *
 * JSON.stringify 的问题：
 * 1. O(n) 在对象大小上，热路径中重复调用有性能开销
 * 2. 不同 key 顺序的同语义对象产生不同字符串（{a:1,b:2} vs {b:2,a:1}）
 * 3. 用作 memo/cache key 时会导致不必要的重计算
 */

// FNV-1a 算法，32位，足够区分不同内容
export function stableKey(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// 对于需要字符串键的场景，按 key 排序保证稳定性
// 输出格式：key:value|key:value，轻量但不可读
export function stableStringKey(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  return keys.map(k => `${k}:${obj[k]}`).join('|');
}

// 对于需要保留 JSON 格式（如 LLM 提示、搜索 haystack）的场景
// 按 key 排序后 stringify，保证同语义对象总是相同输出
export function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return '{}';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => stableStringify(item)).join(',') + ']';
  }
  // 对象：按 key 排序递归序列化
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sorted.map(k => {
    const val = (obj as Record<string, unknown>)[k];
    return `${JSON.stringify(k)}:${stableStringify(val)}`;
  });
  return '{' + pairs.join(',') + '}';
}