# ROLLBACK RUNBOOK

## 触发条件

满足以下任一条件立即触发回退：

- 发布后核心流程不可用（启动失败、接口不可达）。
- 测试基线回归（关键用例失败）。
- 配置变更导致环境无法初始化。

## 回退步骤

1. 定位上一个稳定版本 commit/tag。
2. 回退代码到稳定版本。
3. 恢复对应配置（包含 `.env` 与部署配置）。
4. 重新安装依赖并启动服务。

## 回退后验证

1. 版本检查：

```bash
python -m src.cli.main --version
python -c "import src; print(src.__version__)"
```

2. 健康检查与配置预检：

```bash
python -c "from src.config import init_config, ensure_environment; init_config(hot_reload=False); ensure_environment(strict=False); print('config ok')"
```

3. 最小测试回归：

```bash
pytest
```

## 演练记录模板

- 回退触发原因：
- 回退目标版本：
- 回退执行人：
- 验证结果：
- 是否恢复服务：是 / 否
