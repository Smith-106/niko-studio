## 2025-01-28 - Parallelization Overhead & Thread Safety
**Learning:** Parallelizing search operations (`SmartSearch`) with `ThreadPoolExecutor` increased latency when creating a new executor per request (~14ms vs ~9ms).
**Action:** Reused `ThreadPoolExecutor` as a class instance member to amortize thread creation cost. Also ensured thread safety by verifying that `sqlite3` connections are not shared between threads (each thread opens its own connection via `VectorSearch._get_connection`).
