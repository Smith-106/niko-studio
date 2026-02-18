# -*- coding: utf-8 -*-
"""Extra branch tests for src.db.pool."""

import asyncio
import importlib

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.db import pool as pool_module
from src.db.pool import AsyncConnectionPool, close_all_pools, get_pool


def test_importerror_branch_sets_aiosqlite_none(monkeypatch):
    real_import = __import__

    def _fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "aiosqlite":
            raise ImportError("forced")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr("builtins.__import__", _fake_import)

    import src.db.pool as pool_module

    reloaded = importlib.reload(pool_module)
    assert reloaded.aiosqlite is None

    monkeypatch.setattr("builtins.__import__", real_import)
    importlib.reload(pool_module)


@pytest.mark.asyncio
async def test_initialize_raises_when_aiosqlite_missing(tmp_path):
    db = str(tmp_path / "missing.db")
    pool = AsyncConnectionPool(db)

    with patch.object(pool_module, "aiosqlite", None):
        with pytest.raises(ImportError):
            await pool.initialize()


@pytest.mark.asyncio
async def test_executemany_and_executescript_paths(tmp_path):
    db = str(tmp_path / "batch.db")
    pool = AsyncConnectionPool(db, pool_size=1)
    await pool.initialize()

    try:
        await pool.executescript(
            """
            CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY, v TEXT);
            DELETE FROM t;
            """
        )
        await pool.executemany(
            "INSERT INTO t (v) VALUES (?)",
            [("a",), ("b",), ("c",)],
        )

        rows = await pool.fetchall("SELECT v FROM t ORDER BY v")
        assert [row[0] for row in rows] == ["a", "b", "c"]
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_close_handles_queue_empty_and_close_error(tmp_path):
    db = str(tmp_path / "close.db")
    pool = AsyncConnectionPool(db, pool_size=1)
    await pool.initialize()

    conn = pool._connections[0]
    conn.close = AsyncMock(side_effect=RuntimeError("close failed"))

    with (
        patch.object(pool._pool, "empty", MagicMock(side_effect=[False, True])),
        patch.object(pool._pool, "get_nowait", MagicMock(side_effect=asyncio.QueueEmpty)),
        patch.object(pool_module.logger, "warning") as warn_mock,
    ):
        await pool.close()

    warn_mock.assert_called_once()
    assert pool.is_initialized is False


@pytest.mark.asyncio
async def test_get_pool_singleton_and_close_all_pools(tmp_path):
    await close_all_pools()

    db = str(tmp_path / "singleton.db")
    p1 = await get_pool(db, pool_size=2)
    p2 = await get_pool(str(tmp_path / "singleton.db"), pool_size=5)

    assert p1 is p2
    assert p1.pool_size == 2

    await close_all_pools()
    assert pool_module._global_pools == {}
