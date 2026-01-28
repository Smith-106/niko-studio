## 2025-01-28 - Parallelization Overhead & Thread Safety
**Learning:** Parallelizing search operations (`SmartSearch`) with `ThreadPoolExecutor` increased latency when creating a new executor per request (~14ms vs ~9ms).
**Action:** Reused `ThreadPoolExecutor` as a class instance member to amortize thread creation cost. Also ensured thread safety by verifying that `sqlite3` connections are not shared between threads (each thread opens its own connection via `VectorSearch._get_connection`).

## 2025-01-29 - SQLite Brute Force Search Optimization
**Learning:** Fetching large text/JSON columns during brute-force vector search (when `sqlite-vec` is missing) adds significant overhead (~440ms vs ~240ms for 10k items).
**Action:** Optimize queries to only fetch `id` and `embedding` for similarity calculation, then fetch full content only for the top-k results. This reduces memory usage and serialization costs.
