# IMPL-008 Summary

- Status: completed
- Scope: 按先 soft 后 hard 策略收敛门禁并执行全链路回归。

## Soft/Hard Gate
- soft gate：
  - `pytest tests/unit/workflow/test_workflow_engine.py -k "decision" -q -o addopts=''`
  - `pytest tests/unit/mcp/test_gateway_stream.py -k "contract" -q -o addopts=''`
- selective hard gate：
  - `pytest tests/unit/workflow/test_workflow_engine.py -k "decision" -q -o addopts=''`
  - `pytest tests/unit/mcp/test_gateway_stream.py -k "contract" -q -o addopts=''`
  - `npm --prefix desktop run test -- src/api/client.test.ts src/components/EvaluationPanel.test.tsx`

## 全链路基线
- `pytest tests/unit tests/integration -m "not e2e" --cov=src --cov-report=xml --cov-fail-under=80 --junitxml=pytest-baseline.xml`
- `npm --prefix desktop run test:ci`

## 结果
- Python 基线 4744 passed，覆盖率 80.90%。
- desktop test:ci 4 files / 20 tests 全部通过。
