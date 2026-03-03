"""
Async SQLite Connection Pool using aiosqlite

Features:
- Connection pool with configurable size (5-10 connections)
- Context manager for automatic release
- WAL mode for concurrent reads
- Thread-safe singleton pattern
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, AsyncIterator, Dict, Any

try:
    import aiosqlite
except ImportError:
    aiosqlite = None

logger = logging.getLogger("niko-db")


class AsyncConnectionPool:
    """
    Async SQLite connection pool with WAL mode support.

    Usage:
        pool = AsyncConnectionPool(db_path, pool_size=5)
        await pool.initialize()

        async with pool.acquire() as conn:
            cursor = await conn.execute("SELECT * FROM memories")
            rows = await cursor.fetchall()

        await pool.close()
    """

    def __init__(
        self,
        db_path: str,
        pool_size: int = 5,
        timeout: float = 30.0
    ):
        self.db_path = Path(db_path)
        self.pool_size = min(max(pool_size, 1), 10)  # Clamp to 1-10
        self.timeout = timeout

        self._pool: asyncio.Queue = asyncio.Queue(maxsize=self.pool_size)
        self._connections: list = []
        self._initialized = False
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        """Initialize the connection pool with WAL mode enabled."""
        if aiosqlite is None:
            raise ImportError(
                "aiosqlite is required for AsyncConnectionPool. "
                "Install with: pip install aiosqlite>=0.19.0"
            )

        async with self._lock:
            if self._initialized:
                return

            # Ensure db directory exists
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

            # Create connections
            for i in range(self.pool_size):
                conn = await aiosqlite.connect(
                    str(self.db_path),
                    timeout=self.timeout
                )

                # Enable WAL mode for better concurrent read performance
                await conn.executescript("""
                    PRAGMA journal_mode=WAL;
                    PRAGMA synchronous=NORMAL;
                    PRAGMA cache_size=-64000;
                """)

                # Enable row factory for dict-like access
                conn.row_factory = aiosqlite.Row

                self._connections.append(conn)
                await self._pool.put(conn)

            self._initialized = True
            logger.info(
                f"Connection pool initialized: {self.pool_size} connections "
                f"to {self.db_path}"
            )

    @asynccontextmanager
    async def acquire(self) -> AsyncIterator[aiosqlite.Connection]:
        """
        Acquire a connection from the pool.

        Usage:
            async with pool.acquire() as conn:
                await conn.execute(...)
        """
        if not self._initialized:
            await self.initialize()

        conn = await asyncio.wait_for(
            self._pool.get(),
            timeout=self.timeout
        )

        try:
            yield conn
        finally:
            # Return connection to pool
            await self._pool.put(conn)

    async def execute(self, sql: str, params: tuple = ()) -> aiosqlite.Cursor:
        """Execute a single SQL statement using a pooled connection."""
        async with self.acquire() as conn:
            cursor = await conn.execute(sql, params)
            await conn.commit()
            return cursor

    async def executemany(
        self,
        sql: str,
        params_seq: list
    ) -> aiosqlite.Cursor:
        """Execute SQL with multiple parameter sets."""
        async with self.acquire() as conn:
            cursor = await conn.executemany(sql, params_seq)
            await conn.commit()
            return cursor

    async def executescript(self, script: str) -> None:
        """Execute a SQL script."""
        async with self.acquire() as conn:
            await conn.executescript(script)
            await conn.commit()

    async def fetchall(
        self,
        sql: str,
        params: tuple = ()
    ) -> list:
        """Execute query and fetch all results."""
        async with self.acquire() as conn:
            cursor = await conn.execute(sql, params)
            return await cursor.fetchall()

    async def fetchone(
        self,
        sql: str,
        params: tuple = ()
    ) -> Optional[aiosqlite.Row]:
        """Execute query and fetch one result."""
        async with self.acquire() as conn:
            cursor = await conn.execute(sql, params)
            return await cursor.fetchone()

    async def close(self) -> None:
        """Close all connections in the pool."""
        async with self._lock:
            if not self._initialized:
                return

            # Drain the pool
            while not self._pool.empty():
                try:
                    self._pool.get_nowait()
                except asyncio.QueueEmpty:
                    break

            # Close all connections
            for conn in self._connections:
                try:
                    await conn.close()
                except Exception as e:
                    logger.warning(f"Error closing connection: {e}")

            self._connections.clear()
            self._initialized = False
            logger.info("Connection pool closed")

    @property
    def is_initialized(self) -> bool:
        """Check if pool is initialized."""
        return self._initialized

    @property
    def available_connections(self) -> int:
        """Number of available connections in the pool."""
        return self._pool.qsize()


# Global pool instance (singleton pattern)
_global_pools: Dict[str, AsyncConnectionPool] = {}
_pools_lock = asyncio.Lock()


async def get_pool(
    db_path: str,
    pool_size: int = 5,
    timeout: float = 30.0
) -> AsyncConnectionPool:
    """
    Get or create a connection pool for the given database path.

    This function maintains a singleton pool per database path.

    Args:
        db_path: Path to the SQLite database
        pool_size: Number of connections (1-10)
        timeout: Connection timeout in seconds

    Returns:
        AsyncConnectionPool instance
    """
    db_path = str(Path(db_path).resolve())

    async with _pools_lock:
        if db_path not in _global_pools:
            pool = AsyncConnectionPool(
                db_path,
                pool_size=pool_size,
                timeout=timeout
            )
            await pool.initialize()
            _global_pools[db_path] = pool

        return _global_pools[db_path]


async def close_all_pools() -> None:
    """Close all global connection pools."""
    async with _pools_lock:
        for pool in _global_pools.values():
            await pool.close()
        _global_pools.clear()
