"""
Embedding 缓存实现

使用内存 LRU 缓存，支持 TTL 过期和批量操作。
缓存键使用内容哈希，确保相同文本+模型组合命中。
"""

import hashlib
import time
from collections import OrderedDict
from typing import Any


class InMemoryEmbeddingCache:
    """内存 LRU Embedding 缓存

    特性:
    - LRU 淘汰策略
    - TTL 过期支持
    - 批量读写操作
    - 命中率统计
    """

    def __init__(
        self,
        max_size: int = 10000,
        default_ttl: int = 86400,
    ):
        """初始化缓存

        Args:
            max_size: 最大缓存条目数
            default_ttl: 默认过期时间 (秒)，0 表示永不过期
        """
        self._cache: OrderedDict[str, tuple[list[float], float]] = OrderedDict()
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._hits = 0
        self._misses = 0

    def _make_key(self, text: str, model: str) -> str:
        """生成缓存键

        使用 MD5 哈希确保键长度一致，避免过长文本导致内存问题。
        """
        content = f"{model}:{text}"
        return hashlib.md5(content.encode("utf-8")).hexdigest()

    def _is_expired(self, expire_time: float) -> bool:
        """检查是否过期"""
        if expire_time == 0:
            return False
        return time.time() > expire_time

    def _evict_if_needed(self) -> None:
        """LRU 淘汰"""
        while len(self._cache) >= self._max_size:
            self._cache.popitem(last=False)

    async def get(
        self,
        text: str,
        model: str,
    ) -> list[float] | None:
        """获取缓存的向量"""
        key = self._make_key(text, model)

        if key not in self._cache:
            self._misses += 1
            return None

        embedding, expire_time = self._cache[key]

        if self._is_expired(expire_time):
            del self._cache[key]
            self._misses += 1
            return None

        # 移动到末尾 (最近使用)
        self._cache.move_to_end(key)
        self._hits += 1
        return embedding

    async def set(
        self,
        text: str,
        model: str,
        embedding: list[float],
        ttl: int | None = None,
    ) -> None:
        """设置缓存"""
        self._evict_if_needed()

        key = self._make_key(text, model)
        actual_ttl = ttl if ttl is not None else self._default_ttl
        expire_time = time.time() + actual_ttl if actual_ttl > 0 else 0

        self._cache[key] = (embedding, expire_time)
        self._cache.move_to_end(key)

    async def get_batch(
        self,
        texts: list[str],
        model: str,
    ) -> dict[str, list[float] | None]:
        """批量获取缓存的向量"""
        results = {}
        for text in texts:
            results[text] = await self.get(text, model)
        return results

    async def set_batch(
        self,
        items: dict[str, list[float]],
        model: str,
        ttl: int | None = None,
    ) -> None:
        """批量设置缓存"""
        for text, embedding in items.items():
            await self.set(text, model, embedding, ttl)

    async def clear(self) -> None:
        """清空所有缓存"""
        self._cache.clear()
        self._hits = 0
        self._misses = 0

    async def stats(self) -> dict[str, Any]:
        """获取缓存统计信息"""
        total = self._hits + self._misses
        hit_rate = self._hits / total if total > 0 else 0.0

        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": hit_rate,
            "default_ttl": self._default_ttl,
        }
