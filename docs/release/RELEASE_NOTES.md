# RELEASE NOTES

## 目标

本说明用于内部试运行发布（P0 基线），确保“可安装、可运行、可测试、可追溯、可回退”。

## 发布前检查

1. 安装依赖：

```bash
python -m pip install -r requirements.txt
```

2. 版本一致性校验：

```bash
python scripts/check_versions.py
```

3. 配置预检：

```bash
python -c "from src.config import init_config, ensure_environment; init_config(hot_reload=False); ensure_environment(strict=False); print('config ok')"
```

4. 测试与覆盖率：

```bash
pytest
```

## 发布步骤（dry-run）

1. 确认工作区干净并记录当前 commit。
2. 执行“发布前检查”全部命令。
3. 记录产物版本：
   - Python: `python -c "import src; print(src.__version__)"`
   - CLI: `python -m src.cli.main --version`
   - Desktop: `npm --prefix desktop pkg get version`
4. 在内部发布记录中登记：版本、commit、测试结果、执行人。

## 验收记录模板

- 发布版本：
- 对应 commit：
- 版本一致性检查：通过 / 失败
- 配置预检：通过 / 失败
- 测试覆盖率：
- 结论：Go / No-Go
