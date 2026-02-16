# -*- coding: utf-8 -*-
"""`src.ui.translations` 覆盖测试。"""

import types

import pytest

from src.ui import translations as tr


class _BrokenTemplate:
    def format(self, **_kwargs):
        raise ValueError("broken format")


class _SessionState(dict):
    def get(self, key, default=None):
        return super().get(key, default)


@pytest.fixture
def fake_streamlit(monkeypatch):
    fake_st = types.SimpleNamespace(session_state=_SessionState())
    monkeypatch.setattr(tr, "st", fake_st)
    return fake_st


def test_t_returns_key_when_missing(fake_streamlit):
    fake_streamlit.session_state["language"] = "中文"
    assert tr.t("missing_key") == "missing_key"


def test_t_uses_english_language(fake_streamlit):
    fake_streamlit.session_state["language"] = "English"
    assert tr.t("page_title") == "AI Writing Workbench"


def test_t_format_exception_returns_template(fake_streamlit, monkeypatch):
    fake_streamlit.session_state["language"] = "中文"
    monkeypatch.setitem(tr.TRANSLATIONS, "broken_key", {"zh": _BrokenTemplate()})

    result = tr.t("broken_key", x=1)

    assert isinstance(result, _BrokenTemplate)
