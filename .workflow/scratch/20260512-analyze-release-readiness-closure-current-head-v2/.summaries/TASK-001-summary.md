# TASK-001 Summary

- 选定 `src-ts/config/index.ts` 内的 `APP_VERSION` 作为单一 release authority，并通过 `scripts/check_versions.py` 明确输出 `authoritative source`。
- 当前 task scope 内版本源已统一为 `9.13.0`，`config/*.yaml`、`src-ts/package.json`、`desktop/package.json`、`desktop/src-tauri/tauri.conf.json`、`desktop/src-tauri/Cargo.toml` 与 authority 一致。
- `tests/unit/scripts/test_ci_checks.py` 已补充 authority 回归断言，覆盖 `APP_VERSION` 作为唯一真值来源时的输出与失配行为。
- 验证结果：
  - `python scripts/check_versions.py`：通过。
  - `python -m pytest tests/unit/scripts/test_ci_checks.py -q`：23 个测试全部通过。
- 额外观察：`desktop` 侧 sidecar capability 校验失败属于其他收敛项，不在本任务文件边界内，未在本任务中处理。
