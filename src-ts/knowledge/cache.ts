/**
 * Knowledge module - tiered embedding cache
 *
 * 两层缓存架构：热层（内存 LRU）+ 冷层（SQLite）。
 * 热层保存频繁访问的 embedding，冷层保存从热层淘汰的条目。
 * 查询时先查热层，miss 后查冷层，命中则提升回热层。
 */

import * as crypto from 'crypto';
import BetterSqlite3 from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { tmpdir } from 'os';
import type { EmbeddingCache } from '../protocols/embedding';

type DatabaseType = InstanceType<typeof BetterSqlite3>;

/**
 * 热层缓存条目：embedding + 过期时间戳
 */
interface CacheEntry {
  embedding: number[];
  expireTime: number;
}

/**
 * 两层 Embedding 缓存
 *
 * 热层：内存 LRU，maxSize 默认 2000，保存高频访问条目
 * 冷层：SQLite 表，保存从热层淘汰的低频条目，按 accessed_at 排序
 *
 * 实现 EmbeddingCache 接口，调用方无需感知分层细节。
 */
export class TieredEmbeddingCache implements EmbeddingCache {
  private _cache: Map<string, CacheEntry>;
  private readonly _maxSize: number;
  private readonly _defaultTTL: number;
  private _hits: number = 0;
  private _misses: number = 0;
  private _coldHits: number = 0;

  // 冷层 SQLite
  private _db: DatabaseType | null = null;
  private readonly _dbPath: string;
  private _stmtGet: BetterSqlite3.Statement | null = null;
  private _stmtSet: BetterSqlite3.Statement | null = null;
  private _stmtDelete: BetterSqlite3.Statement | null = null;
  private _stmtAccessed: BetterSqlite3.Statement | null = null;

  constructor(maxSize: number = 2000, defaultTTL: number = 86400, dbPath?: string) {
    this._cache = new Map();
    this._maxSize = maxSize;
    this._defaultTTL = defaultTTL;
    this._dbPath = dbPath ?? resolve(tmpdir(), 'niko-studio', 'embedding-cache.db');
  }

  // ============================================================
  // 冷层生命周期
  // ============================================================

  /** 初始化 SQLite 冷层（惰性，首次写入或查询时触发） */
  private _ensureColdTier(): void {
    if (this._db) return;

    const dir = dirname(this._dbPath);
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this._db = new BetterSqlite3(this._dbPath);
    this._db.pragma('journal_mode = WAL');
    this._db.pragma('synchronous = NORMAL');

    this._db.exec(`
      CREATE TABLE IF NOT EXISTS embedding_cache (
        key TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        accessed_at INTEGER NOT NULL
      )
    `);

    // 预编译语句，避免重复解析 SQL
    this._stmtGet = this._db.prepare('SELECT embedding FROM embedding_cache WHERE key = ?');
    this._stmtSet = this._db.prepare(`
      INSERT INTO embedding_cache (key, embedding, accessed_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET embedding = excluded.embedding, accessed_at = excluded.accessed_at
    `);
    this._stmtDelete = this._db.prepare('DELETE FROM embedding_cache WHERE key = ?');
    this._stmtAccessed = this._db.prepare(
      'UPDATE embedding_cache SET accessed_at = ? WHERE key = ?',
    );
  }

  // ============================================================
  // 序列化 / 反序列化
  // ============================================================

  /** number[] → Buffer（每个 float64 占 8 字节） */
  private _serializeEmbedding(embedding: number[]): Buffer {
    const buf = Buffer.alloc(embedding.length * 8);
    for (let i = 0; i < embedding.length; i++) {
      buf.writeDoubleLE(embedding[i], i * 8);
    }
    return buf;
  }

  /** Buffer → number[] */
  private _deserializeEmbedding(blob: Buffer): number[] {
    const count = blob.length / 8;
    const result = new Array<number>(count);
    for (let i = 0; i < count; i++) {
      result[i] = blob.readDoubleLE(i * 8);
    }
    return result;
  }

  // ============================================================
  // 缓存 key 生成
  // ============================================================

  /**
   * 生成缓存 key
   *
   * 使用 MD5 哈希保证 key 长度一致，避免长文本占用过多内存。
   */
  private _makeKey(text: string, model: string): string {
    const content = `${model}:${text}`;
    return crypto.createHash('md5').update(content, 'utf-8').digest('hex');
  }

  // ============================================================
  // 过期检查
  // ============================================================

  /** 检查条目是否过期 */
  private _isExpired(expireTime: number): boolean {
    if (expireTime === 0) return false;
    return Date.now() / 1000 > expireTime;
  }

  // ============================================================
  // 淘汰：热层 → 冷层
  // ============================================================

  /**
   * LRU 淘汰：当热层满时，将最旧条目写入冷层后从热层移除。
   * Map 保持插入顺序，第一个条目即为最久未使用。
   */
  private _evictIfNeeded(): void {
    while (this._cache.size >= this._maxSize) {
      const firstKey = this._cache.keys().next().value;
      if (firstKey === undefined) break;

      const entry = this._cache.get(firstKey)!;

      // 过期条目直接丢弃，不写入冷层
      if (!this._isExpired(entry.expireTime)) {
        this._ensureColdTier();
        try {
          const blob = this._serializeEmbedding(entry.embedding);
          this._stmtSet!.run(firstKey, blob, Math.floor(Date.now() / 1000));
        } catch {
          // 冷层写入失败不影响热层运行
        }
      }

      this._cache.delete(firstKey);
    }
  }

  // ============================================================
  // 冷层操作
  // ============================================================

  /** 从冷层查找条目 */
  private _getFromCold(key: string): number[] | null {
    this._ensureColdTier();
    try {
      const row = this._stmtGet!.get(key) as { embedding: Buffer } | undefined;
      if (!row) return null;
      // 更新访问时间
      this._stmtAccessed!.run(Math.floor(Date.now() / 1000), key);
      return this._deserializeEmbedding(row.embedding);
    } catch {
      return null;
    }
  }

  /** 将条目提升回热层 */
  private _promoteToHot(key: string, embedding: number[], expireTime: number): void {
    // 热层可能已满，先淘汰再插入
    this._evictIfNeeded();
    this._cache.set(key, { embedding, expireTime });

    // 从冷层删除（已提升到热层）
    this._ensureColdTier();
    try {
      this._stmtDelete!.run(key);
    } catch {
      // 忽略冷层删除失败
    }
  }

  // ============================================================
  // EmbeddingCache 接口实现
  // ============================================================

  /**
   * 获取缓存的向量
   *
   * 查找顺序：热层 → 冷层 → 返回 null
   * 冷层命中时自动提升回热层。
   */
  async get(text: string, model: string): Promise<number[] | null> {
    const key = this._makeKey(text, model);

    // 1. 查热层
    const entry = this._cache.get(key);
    if (entry) {
      if (this._isExpired(entry.expireTime)) {
        this._cache.delete(key);
        this._misses++;
        return null;
      }
      // 移到末尾（最近使用）—— 删除后重新插入
      this._cache.delete(key);
      this._cache.set(key, entry);
      this._hits++;
      return entry.embedding;
    }

    // 2. 查冷层
    const coldEmbedding = this._getFromCold(key);
    if (coldEmbedding !== null) {
      this._coldHits++;
      // 提升回热层，冷层条目视为永不过期（已在磁盘上）
      this._promoteToHot(key, coldEmbedding, 0);
      this._hits++;
      return coldEmbedding;
    }

    // 3. 完全未命中
    this._misses++;
    return null;
  }

  /**
   * 设置缓存条目
   */
  async set(
    text: string,
    model: string,
    embedding: number[],
    ttl?: number | null,
  ): Promise<void> {
    this._evictIfNeeded();

    const key = this._makeKey(text, model);
    const actualTTL = ttl ?? this._defaultTTL;
    const expireTime = actualTTL > 0 ? Date.now() / 1000 + actualTTL : 0;

    // 删除已存在的条目使重新插入到末尾（LRU 排序）
    this._cache.delete(key);
    this._cache.set(key, { embedding, expireTime });
  }

  /**
   * 批量获取缓存的向量
   *
   * 优化：批量计算 key + 批量查热层 + 批量查冷层，
   * 避免逐条调用 get() 带来的重复 LRU 操作和逐次淘汰开销。
   */
  async getBatch(
    texts: string[],
    model: string,
  ): Promise<Record<string, number[] | null>> {
    const results: Record<string, number[] | null> = {};
    if (texts.length === 0) return results;

    // 1. 批量计算所有 key
    const textToKey = new Map<string, string>();
    for (const text of texts) {
      textToKey.set(text, this._makeKey(text, model));
    }

    // 2. 批量查热层，收集冷层待查 key
    const coldLookup: Map<string, string> = new Map(); // key → text
    for (const text of texts) {
      const key = textToKey.get(text)!;
      const entry = this._cache.get(key);

      if (entry) {
        if (this._isExpired(entry.expireTime)) {
          // 过期条目：删除，记为 miss，后续查冷层
          this._cache.delete(key);
          coldLookup.set(key, text);
          this._misses++;
        } else {
          // 热层命中：移到末尾（LRU 更新）
          this._cache.delete(key);
          this._cache.set(key, entry);
          results[text] = entry.embedding;
          this._hits++;
        }
      } else {
        // 热层未命中：待查冷层
        coldLookup.set(key, text);
        this._misses++;
      }
    }

    // 3. 批量查冷层，命中则提升回热层
    if (coldLookup.size > 0) {
      // 先计算需要腾出的空间，一次性淘汰
      const promoteCount = coldLookup.size;
      const available = this._maxSize - this._cache.size;
      const needEvict = promoteCount - available;
      if (needEvict > 0) {
        this._evictBulk(needEvict);
      }

      for (const [key, text] of coldLookup) {
        const coldEmbedding = this._getFromCold(key);
        if (coldEmbedding !== null) {
          this._coldHits++;
          // 提升回热层（已预腾空间，无需逐条淘汰）
          this._cache.set(key, { embedding: coldEmbedding, expireTime: 0 });
          // 从冷层删除
          this._ensureColdTier();
          try {
            this._stmtDelete!.run(key);
          } catch {
            // 忽略冷层删除失败
          }
          results[text] = coldEmbedding;
          // 冷层命中修正：之前记为 miss，实际是 cold hit → hit
          this._misses--;
          this._hits++;
        } else {
          results[text] = null;
        }
      }
    }

    return results;
  }

  /**
   * 批量设置缓存条目
   *
   * 优化：批量计算 key + 一次性计算淘汰量 + 批量写入 Map，
   * 避免逐条调用 set() 带来的逐次淘汰和重复 LRU 操作。
   */
  async setBatch(
    items: Record<string, number[]>,
    model: string,
    ttl?: number | null,
  ): Promise<void> {
    const entries = Object.entries(items);
    if (entries.length === 0) return;

    const actualTTL = ttl ?? this._defaultTTL;
    const expireTime = actualTTL > 0 ? Date.now() / 1000 + actualTTL : 0;

    // 1. 批量计算所有 key
    const keyedEntries: Array<{ key: string; embedding: number[] }> = [];
    const existingKeys = new Set<string>();
    for (const [text, embedding] of entries) {
      const key = this._makeKey(text, model);
      keyedEntries.push({ key, embedding });
      // 检查哪些 key 已在热层（重新插入不增加容量）
      if (this._cache.has(key)) {
        existingKeys.add(key);
      }
    }

    // 2. 一次性计算需要淘汰的数量
    // 新增条目数 = 总写入数 - 已存在的 key 数（已存在只是位置更新）
    const newCount = keyedEntries.length - existingKeys.size;
    const available = this._maxSize - this._cache.size;
    const needEvict = Math.max(0, newCount - available);
    if (needEvict > 0) {
      this._evictBulk(needEvict);
    }

    // 3. 批量写入热层
    for (const { key, embedding } of keyedEntries) {
      // 删除已存在的条目使重新插入到末尾（LRU 排序）
      this._cache.delete(key);
      this._cache.set(key, { embedding, expireTime });
    }
  }

  /**
   * 批量淘汰：一次性从热层淘汰指定数量的最旧条目到冷层。
   *
   * 比逐条调用 _evictIfNeeded() 更高效——只计算一次淘汰量，
   * 避免每次插入后都重新检查容量。
   */
  private _evictBulk(count: number): void {
    let evicted = 0;
    while (evicted < count && this._cache.size > 0) {
      const firstKey = this._cache.keys().next().value;
      if (firstKey === undefined) break;

      const entry = this._cache.get(firstKey)!;

      // 过期条目直接丢弃，不写入冷层
      if (!this._isExpired(entry.expireTime)) {
        this._ensureColdTier();
        try {
          const blob = this._serializeEmbedding(entry.embedding);
          this._stmtSet!.run(firstKey, blob, Math.floor(Date.now() / 1000));
        } catch {
          // 冷层写入失败不影响热层运行
        }
      }

      this._cache.delete(firstKey);
      evicted++;
    }
  }

  /**
   * 清除所有缓存（热层 + 冷层）
   */
  async clear(): Promise<void> {
    this._cache.clear();
    this._hits = 0;
    this._misses = 0;
    this._coldHits = 0;

    this._ensureColdTier();
    try {
      this._db!.exec('DELETE FROM embedding_cache');
    } catch {
      // 忽略冷层清空失败
    }
  }

  /**
   * 获取缓存统计信息
   */
  async stats(): Promise<Record<string, unknown>> {
    const total = this._hits + this._misses;
    const hitRate = total > 0 ? this._hits / total : 0.0;

    // 统计冷层条目数
    let coldSize = 0;
    this._ensureColdTier();
    try {
      const row = this._db!.prepare('SELECT COUNT(*) as cnt FROM embedding_cache').get() as { cnt: number };
      coldSize = row.cnt;
    } catch {
      // 忽略
    }

    return {
      size: this._cache.size,
      maxSize: this._maxSize,
      coldSize,
      hits: this._hits,
      misses: this._misses,
      coldHits: this._coldHits,
      hitRate,
      defaultTTL: this._defaultTTL,
    };
  }

  /**
   * 关闭冷层数据库连接
   *
   * 不属于 EmbeddingCache 接口，但需要在生命周期结束时调用。
   */
  close(): void {
    if (this._db) {
      try {
        this._db.close();
      } catch {
        // 忽略关闭失败
      }
      this._db = null;
      this._stmtGet = null;
      this._stmtSet = null;
      this._stmtDelete = null;
      this._stmtAccessed = null;
    }
  }
}

/**
 * @deprecated 使用 TieredEmbeddingCache 替代。保留别名以兼容旧代码。
 */
export const InMemoryEmbeddingCache = TieredEmbeddingCache;
