# Release Check Summary

- Decision: GO
- Go/No-Go rule: any P0 FAIL => NO_GO
- Codecov strict mode: disabled

## Deterministic Check Results

| check_id | priority | blocking | status |
|---|---|---|---|
| version_consistency | P0 | true | PASS |
| delivery_semantic_gate | P0 | true | PASS |
| baseline_tests_and_coverage | P0 | true | PASS |
| desktop_check | P0 | true | PASS |
| external_e2e_smoke | P1 | false | PASS |
| production_guard | P1 | false | PASS |
| metrics_guard | P1 | false | PASS |
| codecov_signal | P1 | false | PASS |

## Machine-Readable Decision

```json
{
  "decision": "GO",
  "go_no_go_reasons": [],
  "generated_at": "2026-02-17T01:42:48.204202+00:00",
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
      "status": "PASS",
      "exit_code": 0,
      "detail": "status=passed, passed_count=5165"
    },
    {
      "check_id": "desktop_check",
      "priority": "P0",
      "blocking": true,
      "status": "PASS",
      "exit_code": 0,
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
- passed_count: 5165

```text
........................................................................ [  1%]
........................................................................ [  2%]
........................................................................ [  4%]
........................................................................ [  5%]
........................................................................ [  6%]
........................................................................ [  8%]
........................................................................ [  9%]
........................................................................ [ 11%]
........................................................................ [ 12%]
........................................................................ [ 13%]
........................................................................ [ 15%]
........................................................................ [ 16%]
........................................................................ [ 18%]
........................................................................ [ 19%]
........................................................................ [ 20%]
........................................................................ [ 22%]
........................................................................ [ 23%]
........................................................................ [ 25%]
........................................................................ [ 26%]
........................................................................ [ 27%]
........................................................................ [ 29%]
........................................................................ [ 30%]
........................................................................ [ 32%]
........................................................................ [ 33%]
........................................................................ [ 34%]
........................................................................ [ 36%]
........................................................................ [ 37%]
........................................................................ [ 39%]
........................................................................ [ 40%]
........................................................................ [ 41%]
........................................................................ [ 43%]
........................................................................ [ 44%]
........................................................................ [ 45%]
........................................................................ [ 47%]
........................................................................ [ 48%]
........................................................................ [ 50%]
........................................................................ [ 51%]
........................................................................ [ 52%]
........................................................................ [ 54%]
........................................................................ [ 55%]
....s................................................................... [ 57%]
........................................................................ [ 58%]
........................................................................ [ 59%]
........................................................................ [ 61%]
........................................................................ [ 62%]
........................................................................ [ 64%]
........................................................................ [ 65%]
........................................................................ [ 66%]
........................................................................ [ 68%]
........................................................................ [ 69%]
........................................................................ [ 71%]
........................................................................ [ 72%]
........................................................................ [ 73%]
........................................................................ [ 75%]
........................................................................ [ 76%]
........................................................................ [ 78%]
........................................................................ [ 79%]
........................................................................ [ 80%]
........................................................................ [ 82%]
........................................................................ [ 83%]
........................................................................ [ 85%]
........................................................................ [ 86%]
........................................................................ [ 87%]
........................................................................ [ 89%]
........................................................................ [ 90%]
........................................................................ [ 91%]
................................s....................................... [ 93%]
........................................................................ [ 94%]
........................................................................ [ 96%]
........................................................................ [ 97%]
........................................................................ [ 98%]
.......................................................                  [100%]
============================== warnings summary ===============================
src\services\__init__.py:29
  D:\����Ŀ¼\niko-studio\src\services\__init__.py:29: DeprecationWarning: DistillService is deprecated. Use src.memory.distillation_manager.DistillationManager instead.
    from src.services.distill_service import DistillService

src\services\reranker\models.py:21
  D:\����Ŀ¼\niko-studio\src\services\reranker\models.py:21: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class RankedDocument(BaseModel):

tests/unit/mcp/test_gateway_endpoints.py::test_gateway_main_invokes_uvicorn_with_resolved_settings
  <frozen runpy>:128: RuntimeWarning: 'src.mcp.gateway' found in sys.modules after import of package 'src.mcp', but prior to execution of 'src.mcp.gateway'; this may result in unpredictable behaviour

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html

---------- coverage: platform win32, python 3.12.10-final-0 ----------
Coverage XML written to file coverage.xml

Required test coverage of 80% reached. Total coverage: 91.82%
5165 passed, 2 skipped, 16 deselected, 3 warnings in 432.56s (0:07:12)
```

### 4) desktop_check

```text
> niko-studio-desktop@8.0.0 ensure-deps
> node -e "const fs=require('fs');const cp=require('child_process');if(!fs.existsSync('node_modules/typescript/bin/tsc')){console.log('Dependencies missing, running npm ci...');cp.execSync('npm ci',{stdio:'inherit'});}"

> niko-studio-desktop@8.0.0 check
> npm run typecheck && npm run build


> niko-studio-desktop@8.0.0 typecheck
> tsc --noEmit


> niko-studio-desktop@8.0.0 build
> npm run ensure-deps && tsc && vite build


> niko-studio-desktop@8.0.0 ensure-deps
> node -e "const fs=require('fs');const cp=require('child_process');if(!fs.existsSync('node_modules/typescript/bin/tsc')){console.log('Dependencies missing, running npm ci...');cp.execSync('npm ci',{stdio:'inherit'});}"

[36mvite v7.3.1 [32mbuilding client environment for production...[36m[39m
transforming...
[32m✓[39m 1656 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m  0.47 kB[22m[1m[22m[2m │ gzip:   0.31 kB[22m
[2mdist/[22m[35massets/index-CQnRsHfr.css  [39m[1m[2m 21.30 kB[22m[1m[22m[2m │ gzip:   4.88 kB[22m
[2mdist/[22m[36massets/index-5Dv2pNxK.js   [39m[1m[2m362.87 kB[22m[1m[22m[2m │ gzip: 111.26 kB[22m
[32m✓ built in 7.29s[39m
```

### 5) external_e2e_smoke

- status: passed
- passed_count: 16

```text
................                                                         [100%]
16 passed in 7.56s
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
