from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "test_finalize_release_state_module",
        PROJECT_ROOT / "scripts" / "finalize_release_state.py",
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_sync_readme_updates_release_snapshot() -> None:
    module = _load()
    state = module.ReleaseState(
        head_sha="0ed4bb92a0827eb99955a10f172d780ca2840d98",
        release_tag="v9.26.2",
        release_url="https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2",
        asset_names=("Niko-Studio_9.26.2_x64-setup.exe",),
    )
    text = """
- Current release tag: `v9.26.2`
- Current release commit: `ee391eea0088b0bc63b6b63ac0502f6296b8bf16`
- GitHub release: `https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2`
*Version 9.25.8 Platform Edition | Updated: 2026-05-14*
"""
    updated = module.sync_readme(text, state)
    assert "0ed4bb92a0827eb99955a10f172d780ca2840d98" in updated
    assert "Version 9.26.2 Platform Edition | Updated: 2026-05-19" in updated


def test_sync_release_notes_updates_current_head_commit() -> None:
    module = _load()
    state = module.ReleaseState(
        head_sha="0ed4bb92a0827eb99955a10f172d780ca2840d98",
        release_tag="v9.26.2",
        release_url="https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2",
        asset_names=(),
    )
    text = """
- GitHub release：`https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2`
- Release tag：`v9.26.2`
- Current-head release commit：`ee391eea0088b0bc63b6b63ac0502f6296b8bf16`
"""
    updated = module.sync_release_notes(text, state)
    assert "Current-head release commit：`0ed4bb92a0827eb99955a10f172d780ca2840d98`" in updated


def test_sync_release_snapshot_fragment_updates_short_commit() -> None:
    module = _load()
    state = module.ReleaseState(
        head_sha="0ed4bb92a0827eb99955a10f172d780ca2840d98",
        release_tag="v9.26.2",
        release_url="https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2",
        asset_names=(),
    )
    text = """
<p><strong>当前推荐版本：</strong><code>v9.26.2</code>。当前对外发布入口为 GitHub Releases：<a href="https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2">Niko-Studio v9.26.2</a>。</p>
<li>Current release commit：<code>ee391ee</code></li>
"""
    updated = module.sync_release_snapshot_fragment(text, state)
    assert "<code>0ed4bb9</code>" in updated


def test_sync_local_artifact_updates_top_level_head_sha() -> None:
    module = _load()
    payload = {
        "decision": "GO",
        "generated_at": "2026-05-19T15:18:38.603581+00:00",
        "head_sha": "ee391eea0088b0bc63b6b63ac0502f6296b8bf16",
        "release_evidence": {
            "head_sha": "ee391eea0088b0bc63b6b63ac0502f6296b8bf16",
            "generated_at": "2026-05-19T15:18:38.603581+00:00",
        },
        "trace": {"trace_id": "release-readiness-old"},
    }
    state = module.ReleaseState(
        head_sha="0ed4bb92a0827eb99955a10f172d780ca2840d98",
        release_tag="v9.26.2",
        release_url="https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2",
        asset_names=(),
    )
    updated = module.sync_local_artifact(payload, state)
    assert updated["head_sha"] == state.head_sha
    assert updated["release_evidence"]["head_sha"] == state.head_sha
    assert str(updated["trace"]["trace_id"]).startswith("release-readiness-")


def test_run_cmd_raises_with_stdout_and_stderr(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _load()
    monkeypatch.setattr(
        module.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=1, stdout="stdout-text", stderr="stderr-text"),
    )

    with pytest.raises(RuntimeError, match="stdout-text"):
        module.run_cmd(["git", "status"])


def test_run_cmd_returns_trimmed_stdout_on_success(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _load()
    monkeypatch.setattr(
        module.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="ready\n", stderr="ignored"),
    )

    assert module.run_cmd(["git", "status"]) == "ready"


def test_load_release_state_reads_release_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _load()
    calls: list[list[str]] = []

    def fake_run_cmd(cmd: list[str]) -> str:
        calls.append(cmd)
        if cmd[:2] == ["git", "rev-parse"]:
            return "deadbeef"
        return json.dumps(
            {
                "html_url": "https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2",
                "assets": [{"name": "Niko-Studio_9.26.2_x64-setup.exe"}],
            }
        )

    monkeypatch.setattr(module, "run_cmd", fake_run_cmd)

    state = module.load_release_state("v9.26.2")

    assert state.head_sha == "deadbeef"
    assert state.release_tag == "v9.26.2"
    assert state.asset_names == ("Niko-Studio_9.26.2_x64-setup.exe",)
    assert calls == [
        ["git", "rev-parse", "HEAD"],
        ["gh", "api", "repos/Smith-106/niko-studio/releases/tags/v9.26.2"],
    ]


def test_write_text_replace_helpers_and_check_drift_cover_error_paths(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    module = _load()
    target = tmp_path / "note.txt"

    module.write_text(target, "hello")
    assert target.read_text(encoding="utf-8") == "hello"

    with pytest.raises(RuntimeError, match="Expected exactly one replacement"):
        module.replace_once("alpha", "beta", "gamma")

    monkeypatch.setattr(module.re, "subn", lambda *args, **kwargs: ("alpha", 2))
    with pytest.raises(RuntimeError, match="Expected at most one replacement"):
        module.replace_optional("alpha", "alpha", "beta")

    assert module.check_drift("foo\nbar\n", [r"foo", r"missing"]) == [r"foo"]


def test_main_syncs_release_state_files(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys) -> None:
    module = _load()
    state = module.ReleaseState(
        head_sha="0ed4bb92a0827eb99955a10f172d780ca2840d98",
        release_tag="v9.26.2",
        release_url="https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2",
        asset_names=("Niko-Studio_9.26.2_x64-setup.exe",),
    )
    readme = tmp_path / "README.md"
    notes = tmp_path / "RELEASE_NOTES.md"
    release_snapshot_fragment = tmp_path / "shared-doc-fragments.ts"
    summary = tmp_path / "release-check-summary.md"
    artifact = tmp_path / "release-readiness-artifact.json"

    readme.write_text(
        "- Current release tag: `v9.26.1`\n"
        "- Current release commit: `ee391eea0088b0bc63b6b63ac0502f6296b8bf16`\n"
        "- GitHub release: `https://github.com/Smith-106/niko-studio/releases/tag/v9.26.1`\n"
        "*Version 9.25.8 Platform Edition | Updated: 2026-05-14*\n",
        encoding="utf-8",
    )
    notes.write_text(
        "- GitHub release锛歚https://github.com/Smith-106/niko-studio/releases/tag/v9.26.1`\n"
        "- Release tag锛歚v9.26.1`\n"
        "- Current-head release commit锛歚ee391eea0088b0bc63b6b63ac0502f6296b8bf16`\n",
        encoding="utf-8",
    )
    release_snapshot_fragment.write_text(
        '<a href="https://github.com/Smith-106/niko-studio/releases/tag/v9.26.1">link</a>\n'
        "<li>Current release commit锛?code>ee391ee</code></li>\n",
        encoding="utf-8",
    )
    summary.write_text(
        '  "generated_at": "2026-05-19T15:18:38.603581+00:00",\n'
        '  "head_sha": "ee391eea0088b0bc63b6b63ac0502f6296b8bf16",\n'
        "- current_head_sha: ee391eea0088b0bc63b6b63ac0502f6296b8bf16\n"
        "- generated_at: 2026-05-19T15:18:38.603581+00:00\n"
        "- GitHub release `v9.26.1` is aligned to commit `ee391eea0088b0bc63b6b63ac0502f6296b8bf16`.\n",
        encoding="utf-8",
    )
    artifact.write_text(
        json.dumps(
            {
                "decision": "GO",
                "generated_at": "2026-05-19T15:18:38.603581+00:00",
                "head_sha": "ee391eea0088b0bc63b6b63ac0502f6296b8bf16",
                "release_evidence": {
                    "head_sha": "ee391eea0088b0bc63b6b63ac0502f6296b8bf16",
                    "generated_at": "2026-05-19T15:18:38.603581+00:00",
                },
                "trace": {"trace_id": "release-readiness-old"},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(module, "load_release_state", lambda _tag: state)
    monkeypatch.setattr(module, "README_PATH", readme)
    monkeypatch.setattr(module, "RELEASE_NOTES_PATH", notes)
    monkeypatch.setattr(module, "DOCS_SITE_RELEASE_SNAPSHOT_PATH", release_snapshot_fragment)
    monkeypatch.setattr(module, "LOCAL_SUMMARY_PATH", summary)
    monkeypatch.setattr(module, "LOCAL_ARTIFACT_PATH", artifact)

    rc = module.main([])

    assert rc == 0
    assert state.head_sha in readme.read_text(encoding="utf-8")
    assert state.release_url in release_snapshot_fragment.read_text(encoding="utf-8")
    assert state.head_sha in summary.read_text(encoding="utf-8")
    payload = json.loads(artifact.read_text(encoding="utf-8"))
    assert payload["head_sha"] == state.head_sha
    assert payload["release_evidence"]["head_sha"] == state.head_sha
    assert payload["trace"]["trace_id"].startswith("release-readiness-")
    assert '"status": "PASS"' in capsys.readouterr().out


def test_check_mode_detects_old_commit_markers(tmp_path: Path, monkeypatch) -> None:
    module = _load()
    monkeypatch.setattr(module, "load_release_state", lambda _tag: module.ReleaseState(
        head_sha="0ed4bb92a0827eb99955a10f172d780ca2840d98",
        release_tag="v9.26.2",
        release_url="https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2",
        asset_names=(),
    ))
    readme = tmp_path / "README.md"
    notes = tmp_path / "RELEASE_NOTES.md"
    release_snapshot_fragment = tmp_path / "shared-doc-fragments.ts"
    summary = tmp_path / "release-check-summary.md"
    artifact = tmp_path / "release-readiness-artifact.json"
    readme.write_text("- Current release commit: `ee391eea0088b0bc63b6b63ac0502f6296b8bf16`\n*Version 9.25.8 Platform Edition | Updated: 2026-05-14*\n", encoding="utf-8")
    notes.write_text("- Current-head release commit：`ee391eea0088b0bc63b6b63ac0502f6296b8bf16`\n", encoding="utf-8")
    release_snapshot_fragment.write_text("<li>Current release commit：<code>ee391ee</code></li>", encoding="utf-8")
    summary.write_text("- current_head_sha: ee391eea0088b0bc63b6b63ac0502f6296b8bf16\n- generated_at: 2026-05-19T15:18:38.603581+00:00\n- GitHub release `v9.26.1` is aligned to commit `ee391eea0088b0bc63b6b63ac0502f6296b8bf16`.\n  \"generated_at\": \"2026-05-19T15:18:38.603581+00:00\",\n  \"head_sha\": \"ee391eea0088b0bc63b6b63ac0502f6296b8bf16\",\n", encoding="utf-8")
    artifact.write_text(json.dumps({"generated_at": "2026-05-19T15:18:38.603581+00:00", "head_sha": "ee391eea0088b0bc63b6b63ac0502f6296b8bf16", "release_evidence": {"head_sha": "ee391eea0088b0bc63b6b63ac0502f6296b8bf16", "generated_at": "2026-05-19T15:18:38.603581+00:00"}, "trace": {"trace_id": "release-readiness-old"}}, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(module, "README_PATH", readme)
    monkeypatch.setattr(module, "RELEASE_NOTES_PATH", notes)
    monkeypatch.setattr(module, "DOCS_SITE_RELEASE_SNAPSHOT_PATH", release_snapshot_fragment)
    monkeypatch.setattr(module, "LOCAL_SUMMARY_PATH", summary)
    monkeypatch.setattr(module, "LOCAL_ARTIFACT_PATH", artifact)
    rc = module.main(["--check"])
    assert rc == 0


def test_check_mode_reports_failures_when_drift_remains(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    module = _load()
    state = module.ReleaseState(
        head_sha="0ed4bb92a0827eb99955a10f172d780ca2840d98",
        release_tag="v9.26.2",
        release_url="https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2",
        asset_names=(),
    )
    readme = tmp_path / "README.md"
    notes = tmp_path / "RELEASE_NOTES.md"
    release_snapshot_fragment = tmp_path / "shared-doc-fragments.ts"
    summary = tmp_path / "release-check-summary.md"
    artifact = tmp_path / "release-readiness-artifact.json"

    readme.write_text(
        "- Current release tag: `v9.26.1`\n"
        "- Current release commit: `ee391eea0088b0bc63b6b63ac0502f6296b8bf16`\n"
        "- GitHub release: `https://github.com/Smith-106/niko-studio/releases/tag/v9.26.1`\n"
        "*Version 9.25.8 Platform Edition | Updated: 2026-05-14*\n",
        encoding="utf-8",
    )
    notes.write_text(
        "- GitHub release锛歚https://github.com/Smith-106/niko-studio/releases/tag/v9.26.1`\n"
        "- Release tag锛歚v9.26.1`\n"
        "- Current-head release commit锛歚ee391eea0088b0bc63b6b63ac0502f6296b8bf16`\n",
        encoding="utf-8",
    )
    release_snapshot_fragment.write_text(
        '<a href="https://github.com/Smith-106/niko-studio/releases/tag/v9.26.1">link</a>\n'
        "<li>Current release commit锛?code>ee391ee</code></li>\n",
        encoding="utf-8",
    )
    summary.write_text(
        '  "generated_at": "2026-05-19T15:18:38.603581+00:00",\n'
        '  "head_sha": "ee391eea0088b0bc63b6b63ac0502f6296b8bf16",\n'
        "- current_head_sha: ee391eea0088b0bc63b6b63ac0502f6296b8bf16\n"
        "- generated_at: 2026-05-19T15:18:38.603581+00:00\n"
        "- GitHub release `v9.26.1` is aligned to commit `ee391eea0088b0bc63b6b63ac0502f6296b8bf16`.\n",
        encoding="utf-8",
    )
    artifact.write_text(
        json.dumps(
            {
                "generated_at": "2026-05-19T15:18:38.603581+00:00",
                "head_sha": "ee391eea0088b0bc63b6b63ac0502f6296b8bf16",
                "release_evidence": {
                    "head_sha": "ee391eea0088b0bc63b6b63ac0502f6296b8bf16",
                    "generated_at": "2026-05-19T15:18:38.603581+00:00",
                },
                "trace": {"trace_id": "release-readiness-old"},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(module, "load_release_state", lambda _tag: state)
    monkeypatch.setattr(module, "README_PATH", readme)
    monkeypatch.setattr(module, "RELEASE_NOTES_PATH", notes)
    monkeypatch.setattr(module, "DOCS_SITE_RELEASE_SNAPSHOT_PATH", release_snapshot_fragment)
    monkeypatch.setattr(module, "LOCAL_SUMMARY_PATH", summary)
    monkeypatch.setattr(module, "LOCAL_ARTIFACT_PATH", artifact)
    monkeypatch.setattr(module, "check_drift", lambda *_args, **_kwargs: ["stale-marker"])

    rc = module.main(["--check"])

    assert rc == 1
    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "FAIL"
    assert payload["drift"]
