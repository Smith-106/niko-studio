# IMPL-003 Summary

- Task: P0-3 统一 ChatArea 终态语义与 checkpoint 恢复（soft gate）
- Status: completed

## 代码改动
- `src/mcp/gateway.py`: 统一 terminal 事件语义（done/error/interrupted/recovered）并保留 legacy 兼容字段。
- `desktop/src/api/client.ts`: 统一 terminal 解析路径，增加 canonical + legacy fallback 处理。
- `desktop/src/components/ChatArea.tsx`: 收敛恢复态显示与 checkpoint 恢复交互。
- `desktop/src/i18n/translations.ts`: 补齐终态/恢复相关文案 key。
- `desktop/src/api/client.test.ts`: 增加 terminal 语义解析回归断言。
- `desktop/src/components/ChatArea.test.tsx`: 增加 checkpoint 恢复行为断言。

## 验证
- 已执行：`npm --prefix desktop run test -- src/api/client.test.ts -t terminal`
- 结果：4 passed, 2 skipped。
- 已执行：`npm --prefix desktop run test -- src/components/ChatArea.test.tsx -t checkpoint`
- 结果：1 passed, 6 skipped。
- 已执行：`python -m pytest -o addopts="" tests/unit/mcp/test_gateway_stream.py::TestStreamContractCompatibility::test_stream_done_event_contract_legacy_replay tests/unit/mcp/test_gateway_stream.py::TestStreamContractCompatibility::test_stream_error_event_contract_legacy_replay tests/unit/mcp/test_gateway_stream.py -k soft_gate -q`
- 结果：3 passed。

## 说明
- `tests/unit/mcp/test_gateway_stream.py -k backward` 在当前测试命名下无匹配用例（0 selected），因此使用 legacy replay 与 soft_gate 相关用例完成兼容与 soft gate 回归验证。
