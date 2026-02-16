# -*- coding: utf-8 -*-
"""`src.cli.__main__` 覆盖测试。"""

import runpy


def test_module_entry_calls_main_when_run_as_main(monkeypatch):
    import src.cli.main as cli_main

    called = {"count": 0}

    def fake_main():
        called["count"] += 1

    monkeypatch.setattr(cli_main, "main", fake_main)

    runpy.run_module("src.cli.__main__", run_name="__main__")

    assert called["count"] == 1


def test_module_entry_does_not_call_main_when_not_main(monkeypatch):
    import src.cli.main as cli_main

    called = {"count": 0}

    def fake_main():
        called["count"] += 1

    monkeypatch.setattr(cli_main, "main", fake_main)

    runpy.run_module("src.cli.__main__", run_name="src.cli.__main__")

    assert called["count"] == 0
