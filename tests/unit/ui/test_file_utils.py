# -*- coding: utf-8 -*-
"""`src.ui.file_utils` 覆盖测试。"""

import builtins
import importlib.util
import sys
import types
from pathlib import Path

from src.ui import file_utils


class _Uploaded:
    def __init__(self, name):
        self.name = name


class _FakeSplitter:
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    def split_text(self, text):
        return ["chunk-1", "chunk-2"] if text else []


class _FakeIndexingService:
    def __init__(self):
        self.docs = []

    def add_document(self, **kwargs):
        self.docs.append(kwargs)


def test_process_uploaded_file_sanitize_and_progress(monkeypatch):
    monkeypatch.setattr(file_utils.DocumentLoader, "load_file", lambda *_args, **_kwargs: "source text")
    monkeypatch.setattr(file_utils, "RecursiveCharacterTextSplitter", _FakeSplitter)

    svc = _FakeIndexingService()
    progress = []

    count = file_utils.process_uploaded_file(
        _Uploaded("my file@!.txt"),
        "sess-1",
        svc,
        progress_callback=lambda p: progress.append(p),
    )

    assert count == 2
    assert [d["doc_id"] for d in svc.docs] == [
        "sess-1_my_file.txt_part_0",
        "sess-1_my_file.txt_part_1",
    ]
    assert progress == [0.5, 1.0]






def test_process_uploaded_file_no_chunks(monkeypatch):
    class _EmptySplitter:
        def __init__(self, *args, **kwargs):
            pass

        def split_text(self, _text):
            return []

    monkeypatch.setattr(file_utils.DocumentLoader, "load_file", lambda *_args, **_kwargs: "")
    monkeypatch.setattr(file_utils, "RecursiveCharacterTextSplitter", _EmptySplitter)

    svc = _FakeIndexingService()
    count = file_utils.process_uploaded_file(_Uploaded("a.txt"), "sess-2", svc)

    assert count == 0
    assert svc.docs == []


def test_process_uploaded_file_with_chunks_without_progress_callback(monkeypatch):
    monkeypatch.setattr(file_utils.DocumentLoader, "load_file", lambda *_args, **_kwargs: "source text")
    monkeypatch.setattr(file_utils, "RecursiveCharacterTextSplitter", _FakeSplitter)

    svc = _FakeIndexingService()
    count = file_utils.process_uploaded_file(_Uploaded("b.txt"), "sess-3", svc, progress_callback=None)

    assert count == 2
    assert [d["doc_id"] for d in svc.docs] == [
        "sess-3_b.txt_part_0",
        "sess-3_b.txt_part_1",
    ]


def test_file_utils_import_fallback_to_langchain_text_splitter(monkeypatch):
    module_path = Path(__file__).resolve().parents[3] / "src" / "ui" / "file_utils.py"
    module_name = "src.ui.file_utils_import_fallback_test"

    fake_loader_mod = types.ModuleType("src.services.document_loader")
    fake_loader_mod.DocumentLoader = types.SimpleNamespace(load_file=lambda *_args, **_kwargs: "")
    monkeypatch.setitem(sys.modules, "src.services.document_loader", fake_loader_mod)

    fake_indexing_mod = types.ModuleType("src.services.indexing_service")
    fake_indexing_mod.IndexingService = object
    monkeypatch.setitem(sys.modules, "src.services.indexing_service", fake_indexing_mod)

    fake_langchain_pkg = types.ModuleType("langchain")
    fake_text_splitter_mod = types.ModuleType("langchain.text_splitter")
    fake_text_splitter_mod.RecursiveCharacterTextSplitter = _FakeSplitter
    monkeypatch.setitem(sys.modules, "langchain", fake_langchain_pkg)
    monkeypatch.setitem(sys.modules, "langchain.text_splitter", fake_text_splitter_mod)

    original_import = builtins.__import__
    state = {"raised": False}

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "langchain_text_splitters" and not state["raised"]:
            state["raised"] = True
            raise ImportError("simulated import error for fallback")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    sys.modules.pop(module_name, None)
    try:
        spec = importlib.util.spec_from_file_location(module_name, module_path)
        assert spec is not None and spec.loader is not None
        mod = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = mod
        spec.loader.exec_module(mod)

        assert state["raised"] is True
        assert mod.RecursiveCharacterTextSplitter is _FakeSplitter
    finally:
        sys.modules.pop(module_name, None)
