# Release Check Summary

- Decision: NO_GO
- Go/No-Go rule: any P0 FAIL => NO_GO
- Codecov strict mode: disabled

## Deterministic Check Results

| check_id | priority | blocking | status |
|---|---|---|---|
| version_consistency | P0 | true | PASS |
| delivery_semantic_gate | P0 | true | PASS |
| baseline_tests_and_coverage | P0 | true | FAIL |
| desktop_check | P0 | true | FAIL |
| external_e2e_smoke | P1 | false | PASS |
| production_guard | P1 | false | PASS |
| metrics_guard | P1 | false | PASS |
| codecov_signal | P1 | false | PASS |

## Machine-Readable Decision

```json
{
  "decision": "NO_GO",
  "go_no_go_reasons": [
    "baseline_tests_and_coverage",
    "desktop_check"
  ],
  "generated_at": "2026-02-15T13:44:14.587316+00:00",
  "checks": [
    {
      "check_id": "version_consistency",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "scripts/check_versions.py"
    },
    {
      "check_id": "delivery_semantic_gate",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
      "detail": "scripts/delivery_gate.py"
    },
    {
      "check_id": "baseline_tests_and_coverage",
      "priority": "P0",
      "blocking": true,
      "status": "FAIL",
      "exit_code": 1,
      "detail": "status=passed, passed_count=4735"
    },
    {
      "check_id": "desktop_check",
      "priority": "P0",
      "blocking": true,
      "status": "FAIL",
      "exit_code": 2,
      "detail": "npm --prefix desktop run check"
    },
    {
      "check_id": "external_e2e_smoke",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "status=passed, passed_count=16"
    },
    {
      "check_id": "production_guard",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "reload/cors production guards"
    },
    {
      "check_id": "metrics_guard",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "gateway metrics production guard"
    },
    {
      "check_id": "codecov_signal",
      "priority": "P1",
      "blocking": false,
      "status": "PASS",
      "exit_code": 0,
      "detail": "strict_mode=false, token_present=false, coverage.xml available"
    }
  ]
}
```

## Details

### 1) version_consistency

```text
expected version: 8.0.0
- python.__version__: 8.0.0
- config/niko-studio.yaml: 8.0.0
- config/niko-studio.production.yaml: 8.0.0
- desktop/package.json: 8.0.0
- desktop/src-tauri/tauri.conf.json: 8.0.0
- desktop/src-tauri/Cargo.toml: 8.0.0

�汾һ���Լ��ͨ����
```

### 2) delivery_semantic_gate

```text
delivery gate: start
delivery gate: ok
```

### 3) baseline_tests_and_coverage

- status: passed
- passed_count: 4735

```text
........................................................................ [  1%]
........................................................................ [  3%]
........................................................................ [  4%]
........................................................................ [  6%]
........................................................................ [  7%]
........................................................................ [  9%]
........................................................................ [ 10%]
........................................................................ [ 12%]
........................................................................ [ 13%]
........................................................................ [ 15%]
........................................................................ [ 16%]
........................................................................ [ 18%]
........................................................................ [ 19%]
........................................................................ [ 21%]
........................................................................ [ 22%]
........................................................................ [ 24%]
........................................................................ [ 25%]
........................................................................ [ 27%]
........................................................................ [ 28%]
........................................................................ [ 30%]
........................................................................ [ 31%]
........................................................................ [ 33%]
........................................................................ [ 34%]
........................................................................ [ 36%]
........................................................................ [ 37%]
........................................................................ [ 39%]
........................................................................ [ 41%]
........................................................................ [ 42%]
........................................................................ [ 44%]
........................................................................ [ 45%]
........................................................................ [ 47%]
........................................................................ [ 48%]
........................................................................ [ 50%]
........................................................................ [ 51%]
........................................................................ [ 53%]
........................................................................ [ 54%]
........................................................................ [ 56%]
....................s................................................... [ 57%]
.....................................F....................F..F.......... [ 59%]
........................................................................ [ 60%]
........................................................................ [ 62%]
........................................................................ [ 63%]
........................................................................ [ 65%]
........................................................................ [ 66%]
........................................................................ [ 68%]
........................................................................ [ 69%]
........................................................................ [ 71%]
........................................................................ [ 72%]
........................................................................ [ 74%]
........................................................................ [ 75%]
........................................................................ [ 77%]
........................................................................ [ 78%]
........................................................................ [ 80%]
........................................................................ [ 82%]
........................................................................ [ 83%]
........................................................................ [ 85%]
........................................................................ [ 86%]
........................................................................ [ 88%]
........................................................................ [ 89%]
........................................................................ [ 91%]
.....................................s.................................. [ 92%]
........................................................................ [ 94%]
........................................................................ [ 95%]
........................................................................ [ 97%]
........................................................................ [ 98%]
............................................................             [100%]
============================== warnings summary ===============================
src\services\__init__.py:29
  D:\����Ŀ¼\niko-studio\src\services\__init__.py:29: DeprecationWarning: DistillService is deprecated. Use src.memory.distillation_manager.DistillationManager instead.
    from src.services.distill_service import DistillService

src\services\reranker\models.py:21
  D:\����Ŀ¼\niko-studio\src\services\reranker\models.py:21: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class RankedDocument(BaseModel):

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html

---------- coverage: platform win32, python 3.12.10-final-0 ----------
Coverage XML written to file coverage.xml

Required test coverage of 80% reached. Total coverage: 80.68%
=========================== short test summary info ===========================
FAILED tests/unit/test_config.py::TestConfigManagerGetSet::test_get_nested - ...
FAILED tests/unit/test_config.py::TestValidateEnvironment::test_missing_keys
FAILED tests/unit/test_config.py::TestEnsureEnvironment::test_strict_raises
3 failed, 4735 passed, 2 skipped, 16 deselected, 2 warnings in 360.36s (0:06:00)
```

### 4) desktop_check

```text
> niko-studio-desktop@8.0.0 ensure-deps
> node -e "const fs=require('fs');const cp=require('child_process');if(!fs.existsSync('node_modules/typescript/bin/tsc')){console.log('Dependencies missing, running npm ci...');cp.execSync('npm ci',{stdio:'inherit'});}"

> niko-studio-desktop@8.0.0 check
> npm run typecheck && npm run build


> niko-studio-desktop@8.0.0 typecheck
> tsc --noEmit

src/components/EvaluationPanel.test.tsx(54,11): error TS2322: Type '{ id: string; title: string; reason: string; action: string; }' is not assignable to type 'string'.
src/components/EvaluationPanel.test.tsx(55,11): error TS2322: Type '{ id: string; title: string; reason: string; action: string; }' is not assignable to type 'string'.
```

### 5) external_e2e_smoke

- status: passed
- passed_count: 16

```text
................                                                         [100%]
16 passed in 6.70s
```

### 6) production_guard

```text
production guard ok

INFO:src.config:Config loaded from config\niko-studio.production.yaml
INFO:src.config:Config loaded: env=production, debug=False
```

### 7) metrics_guard

```text
metrics guard ok
```

### 8) codecov_signal

- strict_mode: false
- token_present: false
- coverage.xml exists: yes

### 9) CI Integration Tests latest

- policy: do not write back dynamic run_id / run_url to repository files.
- source_of_truth: GitHub Actions `Integration Tests` latest result.
- workflow_url: https://github.com/Smith-106/niko-studio/actions/workflows/integration-tests.yml
