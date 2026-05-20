from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType

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
