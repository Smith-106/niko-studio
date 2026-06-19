# TASK-002 Summary

- Status: completed
- Findings: 将 desktop 前端 capability contract 收束为显式单一真相：`core:default`、`process:default`、`updater:default` 与当前实际使用的 `fs:*` 权限集合。strict validator、capability 文件与治理测试已对齐。
- Files Modified: `desktop/scripts/validate_sidecar_contract.cjs`、`desktop/src-tauri/capabilities/main-desktop.json`、`tests/unit/scripts/test_governance_scripts.py`
- Verification: `npm --prefix desktop run validate:sidecar-contract`；`python -m pytest tests/unit/scripts/test_governance_scripts.py -q -k sidecar_contract`
