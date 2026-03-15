# -*- coding: utf-8 -*-

from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.mark.asyncio
async def test_prewarm_engines_delegates_to_container(monkeypatch):
    import src.mcp.engine as engine

    container = MagicMock()
    container.initialize_all = AsyncMock(return_value=None)

    monkeypatch.setattr(engine, "get_container", lambda: container)

    await engine.prewarm_engines()

    container.initialize_all.assert_awaited_once()
