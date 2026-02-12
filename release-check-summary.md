# Release Check Summary

- Version check: PASS
- e2e smoke: PASS
- Codecov signal (coverage.xml): missing

## Details

### 1) Version consistency

```text
expected version: 8.0.0
- python.__version__: 8.0.0
- config/niko-studio.yaml: 8.0.0
- desktop/package.json: 8.0.0
- desktop/src-tauri/tauri.conf.json: 8.0.0
- desktop/src-tauri/Cargo.toml: 8.0.0

�汾һ���Լ��ͨ����
```

### 2) e2e smoke

- status: passed
- passed_count: 14

```text
..............                                                           [100%]
14 passed in 6.98s

C:\Users\32852\AppData\Local\Programs\Python\Python312\Lib\site-packages\pytest_asyncio\plugin.py:208: PytestDeprecationWarning: The configuration option "asyncio_default_fixture_loop_scope" is unset.
The event loop scope for asynchronous fixtures will default to the fixture caching scope. Future versions of pytest-asyncio will default the loop scope for asynchronous fixtures to function scope. Set the default fixture loop scope explicitly in order to avoid unexpected behavior in the future. Valid fixture loop scopes are: "function", "class", "module", "package", "session"

  warnings.warn(PytestDeprecationWarning(_DEFAULT_FIXTURE_LOOP_SCOPE_UNSET))
```

### 3) Codecov prerequisite

- coverage.xml exists: no
- expected CI upload policy:
  - internal: fail_ci_if_error=false
  - external: fail_ci_if_error=true
