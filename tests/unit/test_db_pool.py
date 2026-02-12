# -*- coding: utf-8 -*-
"""
AsyncConnectionPool Tests

Tests for pool_size clamping, initialize (WAL mode), acquire/release,
execute/fetchall/fetchone, close, and property accessors.
Uses tmp_path for real SQLite database testing.
"""

import asyncio
import pytest
from pathlib import Path

from src.db.pool import AsyncConnectionPool


# ============================================================
# __init__ - pool_size clamping
# ============================================================

class TestAsyncConnectionPoolInit:

    def test_default_pool_size(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db)
        assert pool.pool_size == 5

    def test_pool_size_clamp_lower(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=0)
        assert pool.pool_size == 1

    def test_pool_size_clamp_negative(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=-5)
        assert pool.pool_size == 1

    def test_pool_size_clamp_upper(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=20)
        assert pool.pool_size == 10

    def test_pool_size_within_range(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=3)
        assert pool.pool_size == 3

    def test_pool_size_boundary_1(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=1)
        assert pool.pool_size == 1

    def test_pool_size_boundary_10(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=10)
        assert pool.pool_size == 10

    def test_not_initialized_on_creation(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db)
        assert pool.is_initialized is False

    def test_db_path_is_path_object(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db)
        assert isinstance(pool.db_path, Path)


# ============================================================
# initialize
# ============================================================

class TestAsyncConnectionPoolInitialize:

    async def test_initialize_creates_connections(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=2)
        await pool.initialize()

        try:
            assert pool.is_initialized is True
            assert len(pool._connections) == 2
            assert pool.available_connections == 2
        finally:
            await pool.close()

    async def test_initialize_idempotent(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=2)
        await pool.initialize()
        await pool.initialize()  # second call should be a no-op

        try:
            assert len(pool._connections) == 2
        finally:
            await pool.close()

    async def test_initialize_wal_mode(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=1)
        await pool.initialize()

        try:
            async with pool.acquire() as conn:
                cursor = await conn.execute("PRAGMA journal_mode")
                row = await cursor.fetchone()
                assert row[0].lower() == "wal"
        finally:
            await pool.close()

    async def test_initialize_creates_parent_dirs(self, tmp_path):
        db = str(tmp_path / "sub" / "dir" / "test.db")
        pool = AsyncConnectionPool(db, pool_size=1)
        await pool.initialize()

        try:
            assert pool.is_initialized is True
            assert Path(db).parent.exists()
        finally:
            await pool.close()


# ============================================================
# acquire
# ============================================================

class TestAsyncConnectionPoolAcquire:

    async def test_acquire_and_release(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=2)
        await pool.initialize()

        try:
            assert pool.available_connections == 2
            async with pool.acquire() as conn:
                assert pool.available_connections == 1
                assert conn is not None
            assert pool.available_connections == 2
        finally:
            await pool.close()

    async def test_acquire_auto_initializes(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=1)

        # acquire without explicit initialize
        try:
            async with pool.acquire() as conn:
                assert pool.is_initialized is True
                assert conn is not None
        finally:
            await pool.close()


# ============================================================
# execute / fetchall / fetchone
# ============================================================

class TestAsyncConnectionPoolSQL:

    async def test_execute_create_table(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=1)
        await pool.initialize()

        try:
            await pool.execute(
                "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)"
            )
            rows = await pool.fetchall("SELECT name FROM sqlite_master WHERE type='table' AND name='test'")
            assert len(rows) == 1
        finally:
            await pool.close()

    async def test_execute_insert_and_fetchall(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=1)
        await pool.initialize()

        try:
            await pool.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)")
            await pool.execute("INSERT INTO items (val) VALUES (?)", ("alpha",))
            await pool.execute("INSERT INTO items (val) VALUES (?)", ("beta",))

            rows = await pool.fetchall("SELECT val FROM items ORDER BY val")
            values = [row[0] for row in rows]
            assert values == ["alpha", "beta"]
        finally:
            await pool.close()

    async def test_fetchone_returns_row(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=1)
        await pool.initialize()

        try:
            await pool.execute("CREATE TABLE kv (k TEXT, v TEXT)")
            await pool.execute("INSERT INTO kv (k, v) VALUES (?, ?)", ("key1", "val1"))

            row = await pool.fetchone("SELECT v FROM kv WHERE k = ?", ("key1",))
            assert row is not None
            assert row[0] == "val1"
        finally:
            await pool.close()

    async def test_fetchone_returns_none(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=1)
        await pool.initialize()

        try:
            await pool.execute("CREATE TABLE kv (k TEXT, v TEXT)")

            row = await pool.fetchone("SELECT v FROM kv WHERE k = ?", ("missing",))
            assert row is None
        finally:
            await pool.close()


# ============================================================
# close
# ============================================================

class TestAsyncConnectionPoolClose:

    async def test_close_resets_state(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=2)
        await pool.initialize()
        assert pool.is_initialized is True

        await pool.close()
        assert pool.is_initialized is False
        assert len(pool._connections) == 0

    async def test_close_idempotent(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=1)
        await pool.initialize()
        await pool.close()
        await pool.close()  # should not raise
        assert pool.is_initialized is False

    async def test_close_without_initialize(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=1)
        await pool.close()  # should not raise
        assert pool.is_initialized is False


# ============================================================
# Properties
# ============================================================

class TestAsyncConnectionPoolProperties:

    async def test_is_initialized(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=1)
        assert pool.is_initialized is False

        await pool.initialize()
        assert pool.is_initialized is True

        await pool.close()
        assert pool.is_initialized is False

    async def test_available_connections(self, tmp_path):
        db = str(tmp_path / "test.db")
        pool = AsyncConnectionPool(db, pool_size=3)
        await pool.initialize()

        try:
            assert pool.available_connections == 3

            async with pool.acquire():
                assert pool.available_connections == 2
                async with pool.acquire():
                    assert pool.available_connections == 1

            assert pool.available_connections == 3
        finally:
            await pool.close()
