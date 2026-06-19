# Monitoring Checklist

## Scope

This checklist covers the supported runtime path: `desktop/` + Tauri host + local `src-ts/` Node/TypeScript gateway. It complements the deployment steps in `DESKTOP_RUNBOOK.md` and the rollback triggers in `ROLLBACK.md`.

## Health Endpoints

| Endpoint | Expected Result | Command |
|---|---|---|
| Gateway health | `GET /health` returns `healthy` | `curl http://localhost:8000/health` |
| Metrics | `GET /metrics` returns metrics or is explicitly disabled | `curl http://localhost:8000/metrics` |
| Key tools | `GET /tools` lists available tools | `curl http://localhost:8000/tools` |
| Chat endpoint | `POST /chat` responds without error | See `DESKTOP_RUNBOOK.md` § Contract Verification |

## Runtime Checks

### Local launcher (Windows)

```powershell
./scripts/status_desktop_local.ps1
# or
npm --prefix desktop run local:status
```

Expected: at least one gateway process and the tracked desktop state are reported healthy.

### Docker Compose

```bash
docker compose ps
docker compose logs -f gateway
```

Expected: gateway container status is `healthy`.

### Process health

```powershell
# Windows
Get-Process | Where-Object { $_.ProcessName -match 'niko|gateway|node' }

# Linux/macOS
ps aux | grep -E 'niko|gateway|node'
```

## Alert Thresholds

| Signal | Warning | Critical |
|---|---|---|
| Gateway HTTP latency (p95) | > 500 ms | > 2000 ms |
| CPU usage (gateway host) | > 70% for 5 min | > 90% for 5 min |
| Memory usage (gateway process) | > 1 GB | > 2 GB |
| `/health` status | `degraded` | not reachable for 30 s |
| Disk (`.writing/`) | > 80% full | > 95% full |

## Log Checks

```bash
# Gateway logs when running from repo root
python scripts/start_gateway.py --host 127.0.0.1 --port 8000

# Docker logs
docker compose logs -f gateway

# Desktop local launcher logs are written by the PowerShell status script
```

Look for:

- `EMBEDDING ENGINE DEGRADED` — semantic search will return poor results until an embedding model is installed.
- Repeated uncaught exceptions or `500` responses.
- `degraded` status in `/health`.

## Troubleshooting

| Symptom | Check | Action |
|---|---|---|
| Desktop cannot connect to gateway | `curl http://localhost:8000/health` | Restart gateway with `python scripts/start_gateway.py` or `npm --prefix desktop run local:start` |
| Sidebar entries do not open | Desktop process state | Stop and restart desktop: `npm --prefix desktop run local:stop` then `local:start` |
| Chat streaming fails | Gateway logs and `/health` | Restart gateway; verify non-streaming message works first |
| High memory usage | Gateway process size, `.writing/` size | Restart gateway and review memory-heavy operations; see `ROLLBACK.md` if restart does not recover |
| Docker health check fails | `docker compose ps`, port conflict | Check port `8000` is free; run `docker compose down && docker compose up -d` |

## Release Readiness

Use these scripts to refresh the release evidence used by `scripts/release_check_summary.py`:

```bash
python scripts/refresh_release_evidence.py
python scripts/release_check_summary.py
```

For full release sign-off, see `docs/release/SIGN_OFF.md`.

## Related Documents

- `docs/operations/DESKTOP_RUNBOOK.md` — delivery contract, quick start, contract verification, packaging.
- `docs/operations/ROLLBACK.md` — rollback triggers, rollback steps, post-rollback verification.
- `docs/release/SIGN_OFF.md` — release checklist and Go/No-Go criteria.
- `.github/workflows/integration-tests.yml` — CI authoritative entry point.
