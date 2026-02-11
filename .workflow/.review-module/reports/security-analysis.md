# Security Analysis Report - niko-studio

**Scan Date**: 2026-02-09
**Scope**: `src/**/*.py` (166 files, 62,163 lines)
**Tool**: Manual security code review

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 2 |
| Low | 5 |
| **Total** | **7** |

The niko-studio codebase demonstrates generally good security practices. No critical or high-severity vulnerabilities were identified. The main areas for improvement are credential handling and input validation for deserialization.

---

## Findings

### SEC-001: WebDAV Credentials in Plain Text Configuration

| Field | Value |
|-------|-------|
| Severity | Medium |
| Category | Sensitive Data Exposure |
| File | `src/config.py:175` |

**Description**
WebDAV password is stored as a plain text string field in the BackupConfig dataclass.

```python
webdav_password: str = ""
```

**Recommendation**
- Use environment variables: `os.environ.get("WEBDAV_PASSWORD")`
- Consider using `keyring` library for secure local credential storage
- Implement a secrets manager integration for production deployments

---

### SEC-002: Subprocess Execution (ripgrep)

| Field | Value |
|-------|-------|
| Severity | Low |
| Category | Command Injection |
| File | `src/search/smart_search.py:164` |

**Description**
Uses subprocess.run to execute ripgrep commands. The implementation is safe as it uses list format for arguments.

```python
result = subprocess.run(
    ["rg", "--version"],
    capture_output=True,
    text=True,
    timeout=5
)
```

**Recommendation**
- Current implementation is secure (list format prevents shell injection)
- Ensure search patterns are sanitized at the API boundary

---

### SEC-003: Git Command Execution

| Field | Value |
|-------|-------|
| Severity | Low |
| Category | Command Injection |
| File | `src/workflow/workflow_engine.py:314-323` |

**Description**
Git commands include user-provided descriptions in commit messages.

```python
commit_msg = f"[checkpoint:{checkpoint_id}] {description or 'Auto checkpoint'}"
subprocess.run(["git", "commit", "-m", commit_msg], ...)
```

**Recommendation**
- Current implementation is safe (git handles message as single argument)
- Consider sanitizing description to prevent newline injection in commit messages

---

### SEC-004: WebSocket JSON Deserialization

| Field | Value |
|-------|-------|
| Severity | Low |
| Category | Insecure Deserialization |
| File | `src/web/app.py:120` |

**Description**
WebSocket messages are parsed without schema validation.

```python
message = json.loads(data)
```

**Recommendation**
- Implement pydantic models for WebSocket message validation
- Add message type checking before processing

---

### SEC-005: LLM Response Deserialization

| Field | Value |
|-------|-------|
| Severity | Low |
| Category | Insecure Deserialization |
| Files | Multiple narrative modules |

**Description**
LLM responses are parsed as JSON without validation across multiple files:
- `src/narrative/character_depth.py:284, 308, 332, 379`
- `src/narrative/premise_validator.py:190, 225, 262`
- `src/narrative/suspense_analyzer.py:240, 277, 308`

**Recommendation**
- Create a shared utility function with try-except handling
- Use pydantic models for response structure validation

---

### SEC-006: HTTP Requests with Credentials

| Field | Value |
|-------|-------|
| Severity | Medium |
| Category | Authentication |
| File | `src/services/backup_manager.py:524` |

**Description**
WebDAV backup operations transmit credentials over HTTP requests.

```python
response = requests.put(...)
```

**Recommendation**
- Enforce HTTPS-only connections
- Add explicit `verify=True` for SSL certificate validation
- Log authentication failures for security monitoring

---

### SEC-007: API Response Parsing

| Field | Value |
|-------|-------|
| Severity | Low |
| Category | Information Exposure |
| File | `src/knowledge/services/llm_service.py:220` |

**Description**
LLM service JSON parsing may expose internal details on failure.

**Recommendation**
- Wrap in try-except with generic error messages
- Log detailed errors internally only

---

## Positive Security Observations

The codebase demonstrates several security best practices:

1. **SQL Injection Prevention**: Database operations in `src/db/pool.py` use parameterized queries with tuple parameters
   ```python
   async def execute(self, sql: str, params: tuple = ()) -> aiosqlite.Cursor:
       cursor = await conn.execute(sql, params)
   ```

2. **No Dangerous Deserialization**: No `pickle.load()` or `yaml.load()` with untrusted data

3. **No Code Execution Vulnerabilities**: No `eval()` or `exec()` with user input

4. **SSL Verification Enabled**: No `verify=False` patterns found in HTTP clients

5. **Safe Subprocess Calls**: All subprocess.run calls use list format, preventing shell injection

6. **Proper Path Handling**: Uses pathlib for file operations with proper path validation

---

## Recommendations Summary

| Priority | Action |
|----------|--------|
| High | Move WebDAV credentials to environment variables or secrets manager |
| Medium | Add pydantic validation for WebSocket and LLM response parsing |
| Low | Add explicit SSL verification to HTTP clients |
| Low | Create shared JSON parsing utility with error handling |

---

## Files Reviewed

Key security-sensitive files analyzed:
- `src/config.py` - Configuration and credentials
- `src/db/pool.py` - Database operations
- `src/search/smart_search.py` - Subprocess execution
- `src/workflow/workflow_engine.py` - Git operations
- `src/web/app.py` - WebSocket handling
- `src/services/backup_manager.py` - Remote backup operations
- `src/knowledge/services/providers/*` - API integrations
- `src/narrative/*.py` - LLM response parsing
