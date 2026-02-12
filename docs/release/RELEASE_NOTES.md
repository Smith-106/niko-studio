# RELEASE NOTES

## 发布级别矩阵

| 级别 | 用途 | e2e 冒烟 | Codecov 上传失败 | 结论 |
|---|---|---|---|---|
| internal | 内部 dry-run / 日常集成验证 | 可跳过 | 告警，不阻断 | 用于内部验证 |
| external | 对外交付 / 正式发布 | 必须通过 | 阻断发布 | 满足 Go/No-Go 条件后放行 |

## External 发布准入条件（Go/No-Go）

满足以下全部条件方可 Go：

1. 版本一致性通过：

```bash
python scripts/check_versions.py
```

2. 配置预检通过：

```bash
python -c "from src.config import init_config, ensure_environment; init_config(hot_reload=False); ensure_environment(strict=False); print('config ok')"
```

3. 测试门禁通过：

```bash
# 交付基线（单元 + 集成，排除 e2e）
pytest tests/unit tests/integration -m "not e2e" --cov=src --cov-report=term-missing --cov-fail-under=80
```

4. e2e 冒烟通过（external 必选）：

```bash
# 覆盖 pytest.ini 的默认 addopts，按 e2e marker 执行 external 冒烟
pytest -o addopts="" -m "e2e" tests/integration/test_e2e_workflow.py -q --tb=short
```

> 约定：external 冒烟用例需显式标注 `@pytest.mark.e2e`，以保证门禁与测试分类一致。

5. 质量信号完整：覆盖率报告生成并上传成功（external 场景下 Codecov 上传失败即 No-Go），并且 CI 产出 `coverage-xml`、`pytest-baseline-report`、`pytest-e2e-report-*` 工件可追溯。

6. 生产安全配置有效：`env=production` 时 CORS 白名单必须为真实域名，禁止 `*` 与 localhost 占位。
   - Python: `python -c "import src; print(src.__version__)"`
   - CLI: `python -m src.cli.main --version`
   - Desktop: `npm --prefix desktop pkg get version`

7. 回退预案已确认：`docs/operations/ROLLBACK.md` 中 external 回退触发与验证项均可执行。

8. 发布检查汇总完成：

```bash
python scripts/release_check_summary.py
```

## 发布步骤

### internal（dry-run）

1. 确认工作区干净并记录当前 commit。
2. 执行版本一致性、配置预检、交付基线测试。
3. 记录产物版本与测试结果。

### external（正式交付）

1. 执行 internal 全部步骤。
2. 执行 e2e 冒烟。
3. 确认质量信号完整（覆盖率 + CI 关键信号）。
4. 核对回退预案与回滚验证路径。
5. 评审 Go/No-Go 并登记结果。

## 验收记录模板

- 发布级别：internal / external
- 发布版本：
- 对应 commit：
- 版本一致性检查：通过 / 失败
- 配置预检：通过 / 失败
- 基线测试与覆盖率：
- e2e 冒烟（external 必填）：通过 / 失败 / 跳过（internal）
- 质量信号完整性（覆盖率上传、CI 关键步骤）：完整 / 不完整
- 回退预案确认：是 / 否
- 结论：Go / No-Go
