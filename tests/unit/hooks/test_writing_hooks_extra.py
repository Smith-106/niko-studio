# -*- coding: utf-8 -*-
"""WritingHooks tests - HookResult, HookContext, Hook, HookRegistry, WritingHooks, preset hooks."""

import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock

from src.hooks.writing_hooks import (
    HookType,
    HookPriority,
    HookResult,
    HookContext,
    Hook,
    HookRegistry,
    WritingHooks,
    get_default_writing_hooks,
    _create_content_length_hook,
    _create_encoding_hook,
    _create_error_logging_hook,
)


class TestHookResult:
    def test_ok(self):
        r = HookResult.ok("modified", key="val")
        assert r.success is True
        assert r.modified_content == "modified"
        assert r.metadata["key"] == "val"

    def test_ok_no_content(self):
        r = HookResult.ok()
        assert r.success is True
        assert r.modified_content is None

    def test_fail(self):
        err = ValueError("bad")
        r = HookResult.fail(err, should_continue=True)
        assert r.success is False
        assert r.error is err
        assert r.should_continue is True

    def test_fail_default_no_continue(self):
        r = HookResult.fail(RuntimeError("x"))
        assert r.should_continue is False

    def test_skip(self):
        r = HookResult.skip()
        assert r.success is True
        assert r.should_continue is True


class TestHookContext:
    def test_defaults(self):
        ctx = HookContext(content="hello")
        assert ctx.content == "hello"
        assert ctx.skill_id is None
        assert ctx.metadata == {}

    def test_with_content(self):
        ctx = HookContext(content="old", skill_id="s1", metadata={"k": "v"})
        new_ctx = ctx.with_content("new")
        assert new_ctx.content == "new"
        assert new_ctx.skill_id == "s1"
        assert new_ctx.metadata == {"k": "v"}
        # Original unchanged
        assert ctx.content == "old"

    def test_with_content_copies_metadata(self):
        ctx = HookContext(content="a", metadata={"x": 1})
        new_ctx = ctx.with_content("b")
        new_ctx.metadata["y"] = 2
        assert "y" not in ctx.metadata


class TestHook:
    @pytest.mark.asyncio
    async def test_sync_hook(self):
        def my_hook(ctx):
            return HookResult.ok(ctx.content.upper())

        h = Hook(name="upper", hook_type=HookType.PRE_WRITE, func=my_hook)
        ctx = HookContext(content="hello")
        result = await h.execute(ctx)
        assert result.success is True
        assert result.modified_content == "HELLO"

    @pytest.mark.asyncio
    async def test_async_hook(self):
        async def my_async_hook(ctx):
            return HookResult.ok(ctx.content + "_async")

        h = Hook(name="async_h", hook_type=HookType.POST_WRITE, func=my_async_hook)
        ctx = HookContext(content="data")
        result = await h.execute(ctx)
        assert result.success is True
        assert result.modified_content == "data_async"

    @pytest.mark.asyncio
    async def test_disabled_hook(self):
        def my_hook(ctx):
            return HookResult.ok("should not run")

        h = Hook(name="disabled", hook_type=HookType.PRE_WRITE, func=my_hook, enabled=False)
        ctx = HookContext(content="original")
        result = await h.execute(ctx)
        assert result.success is True
        assert result.modified_content is None  # skip returns no modified content

    @pytest.mark.asyncio
    async def test_hook_exception(self):
        def bad_hook(ctx):
            raise RuntimeError("boom")

        h = Hook(name="bad", hook_type=HookType.PRE_WRITE, func=bad_hook)
        ctx = HookContext(content="test")
        result = await h.execute(ctx)
        assert result.success is False
        assert result.should_continue is True


class TestHookRegistry:
    def test_add_hook(self):
        reg = HookRegistry()
        h = Hook(name="test", hook_type=HookType.PRE_WRITE, func=lambda ctx: HookResult.ok())
        reg.add_hook(h)
        assert "test" in reg.list_hooks(HookType.PRE_WRITE)

    def test_remove_hook(self):
        reg = HookRegistry()
        h = Hook(name="rem", hook_type=HookType.PRE_WRITE, func=lambda ctx: HookResult.ok())
        reg.add_hook(h)
        assert reg.remove_hook(HookType.PRE_WRITE, "rem") is True
        assert "rem" not in reg.list_hooks(HookType.PRE_WRITE)

    def test_remove_hook_not_found(self):
        reg = HookRegistry()
        assert reg.remove_hook(HookType.PRE_WRITE, "nonexistent") is False

    def test_enable_disable_hook(self):
        reg = HookRegistry()
        h = Hook(name="toggle", hook_type=HookType.POST_WRITE, func=lambda ctx: HookResult.ok())
        reg.add_hook(h)
        assert reg.enable_hook(HookType.POST_WRITE, "toggle", False) is True
        assert h.enabled is False
        assert reg.enable_hook(HookType.POST_WRITE, "toggle", True) is True
        assert h.enabled is True

    def test_enable_not_found(self):
        reg = HookRegistry()
        assert reg.enable_hook(HookType.PRE_WRITE, "none", True) is False

    def test_register_decorator(self):
        reg = HookRegistry()

        @reg.register(HookType.PRE_WRITE, name="deco_hook")
        def my_hook(ctx):
            return HookResult.ok()

        assert "deco_hook" in reg.list_hooks(HookType.PRE_WRITE)

    def test_priority_ordering(self):
        reg = HookRegistry()
        h_low = Hook(name="low", hook_type=HookType.PRE_WRITE, func=lambda c: HookResult.ok(), priority=HookPriority.LOW)
        h_high = Hook(name="high", hook_type=HookType.PRE_WRITE, func=lambda c: HookResult.ok(), priority=HookPriority.HIGH)
        reg.add_hook(h_low)
        reg.add_hook(h_high)
        names = reg.list_hooks(HookType.PRE_WRITE)
        assert names.index("high") < names.index("low")

    @pytest.mark.asyncio
    async def test_execute_skips_disabled_hook_branch(self):
        reg = HookRegistry()

        called = {"enabled": False, "disabled": False}

        def enabled_hook(ctx):
            called["enabled"] = True
            return HookResult.ok(ctx.content + "E")

        def disabled_hook(ctx):
            called["disabled"] = True
            return HookResult.ok(ctx.content + "D")

        reg.add_hook(Hook(name="enabled", hook_type=HookType.PRE_WRITE, func=enabled_hook, priority=HookPriority.HIGH))
        reg.add_hook(Hook(name="disabled", hook_type=HookType.PRE_WRITE, func=disabled_hook, enabled=False, priority=HookPriority.LOW))

        result = await reg.execute(HookType.PRE_WRITE, HookContext(content="X"))
        assert result.success is True
        assert result.modified_content == "XE"
        assert called["enabled"] is True
        assert called["disabled"] is False

    @pytest.mark.asyncio
    async def test_execute_stops_on_failure(self):
        reg = HookRegistry()

        def fail_hook(ctx):
            return HookResult.fail(ValueError("stop"))

        def never_run(ctx):
            return HookResult.ok("never")

        reg.add_hook(Hook(name="fail", hook_type=HookType.PRE_WRITE, func=fail_hook, priority=HookPriority.HIGH))
        reg.add_hook(Hook(name="after", hook_type=HookType.PRE_WRITE, func=never_run, priority=HookPriority.LOW))

        ctx = HookContext(content="test")
        result = await reg.execute(HookType.PRE_WRITE, ctx)
        assert result.success is False

    @pytest.mark.asyncio
    async def test_execute_stops_on_should_continue_false(self):
        reg = HookRegistry()

        def stop_hook(ctx):
            return HookResult(success=True, modified_content=ctx.content + "S", should_continue=False)

        def never_run(ctx):
            return HookResult.ok(ctx.content + "N")

        reg.add_hook(Hook(name="stop", hook_type=HookType.PRE_WRITE, func=stop_hook, priority=HookPriority.HIGH))
        reg.add_hook(Hook(name="after", hook_type=HookType.PRE_WRITE, func=never_run, priority=HookPriority.LOW))

        ctx = HookContext(content="X")
        result = await reg.execute(HookType.PRE_WRITE, ctx)
        assert result.success is True
        assert result.modified_content == "XS"

    def test_list_hooks_all(self):
        reg = HookRegistry()
        reg.add_hook(Hook(name="a", hook_type=HookType.PRE_WRITE, func=lambda c: HookResult.ok()))
        reg.add_hook(Hook(name="b", hook_type=HookType.POST_WRITE, func=lambda c: HookResult.ok()))
        all_names = reg.list_hooks()
        assert "a" in all_names
        assert "b" in all_names

    def test_clear_specific(self):
        reg = HookRegistry()
        reg.add_hook(Hook(name="a", hook_type=HookType.PRE_WRITE, func=lambda c: HookResult.ok()))
        reg.add_hook(Hook(name="b", hook_type=HookType.POST_WRITE, func=lambda c: HookResult.ok()))
        reg.clear(HookType.PRE_WRITE)
        assert reg.list_hooks(HookType.PRE_WRITE) == []
        assert "b" in reg.list_hooks(HookType.POST_WRITE)

    def test_clear_all(self):
        reg = HookRegistry()
        reg.add_hook(Hook(name="a", hook_type=HookType.PRE_WRITE, func=lambda c: HookResult.ok()))
        reg.add_hook(Hook(name="b", hook_type=HookType.ON_ERROR, func=lambda c: HookResult.ok()))
        reg.clear()
        assert reg.list_hooks() == []


class TestWritingHooks:
    @pytest.mark.asyncio
    async def test_pre_write(self):
        wh = WritingHooks()
        result = await wh.pre_write("content", skill_id="s1")
        assert result.success is True

    @pytest.mark.asyncio
    async def test_post_write(self):
        wh = WritingHooks()
        result = await wh.post_write("output", agent_id="a1")
        assert result.success is True

    @pytest.mark.asyncio
    async def test_on_error(self):
        wh = WritingHooks()
        result = await wh.on_error(RuntimeError("test"), content="bad content")
        assert result.success is True

    @pytest.mark.asyncio
    async def test_pre_evaluate(self):
        wh = WritingHooks()
        result = await wh.pre_evaluate("text to evaluate")
        assert result.success is True

    @pytest.mark.asyncio
    async def test_post_evaluate(self):
        wh = WritingHooks()
        result = await wh.post_evaluate("text", scores={"quality": 0.8})
        assert result.success is True

    @pytest.mark.asyncio
    async def test_post_evaluate_no_scores(self):
        wh = WritingHooks()
        result = await wh.post_evaluate("text")
        assert result.success is True


class TestPresetHooks:
    @pytest.mark.asyncio
    async def test_content_length_short(self):
        h = _create_content_length_hook()
        ctx = HookContext(content="hi")
        result = await h.execute(ctx)
        assert result.success is False

    @pytest.mark.asyncio
    async def test_content_length_ok(self):
        h = _create_content_length_hook()
        ctx = HookContext(content="This is valid content for testing")
        result = await h.execute(ctx)
        assert result.success is True

    @pytest.mark.asyncio
    async def test_content_length_too_long(self):
        h = _create_content_length_hook()
        ctx = HookContext(content="x" * 100001)
        result = await h.execute(ctx)
        assert result.success is False

    @pytest.mark.asyncio
    async def test_encoding_ok(self):
        h = _create_encoding_hook()
        ctx = HookContext(content="Hello 你好")
        result = await h.execute(ctx)
        assert result.success is True

    @pytest.mark.asyncio
    async def test_encoding_unicode_encode_error_branch(self, monkeypatch):
        h = _create_encoding_hook()

        class BadContent:
            def encode(self, *_args, **_kwargs):
                raise UnicodeEncodeError("utf-8", "x", 0, 1, "bad")

        ctx = HookContext(content=BadContent())
        result = await h.execute(ctx)
        assert result.success is False

    @pytest.mark.asyncio
    async def test_error_logging_executes_error_branch(self, monkeypatch):
        h = _create_error_logging_hook()
        logger_mock = MagicMock()
        monkeypatch.setattr("src.hooks.writing_hooks.logger", logger_mock)
        ctx = HookContext(content="", error=RuntimeError("test error"), skill_id="s", agent_id="a")
        result = await h.execute(ctx)
        assert result.success is True
        logger_mock.error.assert_called_once()

    @pytest.mark.asyncio
    async def test_error_logging_no_error(self):
        h = _create_error_logging_hook()
        ctx = HookContext(content="ok")
        result = await h.execute(ctx)
        assert result.success is True


class TestGetDefaultWritingHooks:
    @pytest.mark.asyncio
    async def test_default_hooks_valid_content(self):
        wh = get_default_writing_hooks()
        result = await wh.pre_write("This is a valid test content")
        assert result.success is True

    @pytest.mark.asyncio
    async def test_default_hooks_short_content(self):
        wh = get_default_writing_hooks()
        result = await wh.pre_write("hi")
        assert result.success is False

    def test_default_hooks_has_hooks(self):
        wh = get_default_writing_hooks()
        hooks = wh.registry.list_hooks()
        assert len(hooks) >= 3
