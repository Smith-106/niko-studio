use crate::gateway_runtime::{is_gateway_healthy, GatewayState};
use std::sync::Mutex;
use std::collections::HashMap;

/// 大载荷分片阈值：100KB
/// 超过此大小的响应会被自动分片，避免 Tauri IPC 序列化开销和渲染端 GC 压力
const CHUNK_THRESHOLD_BYTES: usize = 100 * 1024;
/// 每个分片目标大小：64KB
const CHUNK_SIZE_BYTES: usize = 64 * 1024;

/// 缓存的分片响应条目
struct CachedChunkedResponse {
    #[allow(dead_code)]
    status_code: u16,
    chunks: Vec<String>,
    created_at: std::time::Instant,
}

/// 分片缓存：存储已拆分的大载荷，供后续逐块获取
static CHUNK_CACHE: once_cell::sync::Lazy<Mutex<HashMap<String, CachedChunkedResponse>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(HashMap::new()));

/// 分片缓存过期时间（60 秒）
const CHUNK_CACHE_TTL_SECS: u64 = 60;

/// 清理过期的分片缓存
fn cleanup_chunk_cache(cache: &mut HashMap<String, CachedChunkedResponse>) {
    cache.retain(|_, entry| entry.created_at.elapsed().as_secs() < CHUNK_CACHE_TTL_SECS);
}

#[tauri::command]
pub async fn get_gateway_base(
    app: tauri::AppHandle,
    state: tauri::State<'_, GatewayState>,
) -> Result<String, String> {
    state.resolve_base(&app).await
}

#[tauri::command]
pub async fn set_gateway_base_override(
    base: Option<String>,
    state: tauri::State<'_, GatewayState>,
) -> Result<(), String> {
    state.set_base_override(base);
    Ok(())
}

#[tauri::command]
pub async fn start_backend(
    app: tauri::AppHandle,
    state: tauri::State<'_, GatewayState>,
) -> Result<String, String> {
    let base = state.resolve_base(&app).await?;
    Ok(format!("Gateway ready: {base}"))
}

#[tauri::command]
pub async fn check_backend_health(
    app: tauri::AppHandle,
    state: tauri::State<'_, GatewayState>,
) -> Result<bool, String> {
    let base_url = state.resolve_base(&app).await?;
    Ok(is_gateway_healthy(&base_url).await)
}

#[tauri::command]
pub async fn call_api(
    app: tauri::AppHandle,
    state: tauri::State<'_, GatewayState>,
    endpoint: String,
    method: String,
    body: Option<String>,
) -> Result<String, String> {
    let base_url = state.resolve_base(&app).await?;
    let url = format!("{}{}", base_url, endpoint);
    let client = reqwest::Client::new();

    let response = match method.as_str() {
        "GET" => client.get(&url).send().await,
        "POST" => {
            let mut req = client.post(&url);
            if let Some(body) = body {
                req = req.header("Content-Type", "application/json").body(body);
            }
            req.send().await
        }
        "PUT" => {
            let mut req = client.put(&url);
            if let Some(body) = body {
                req = req.header("Content-Type", "application/json").body(body);
            }
            req.send().await
        }
        _ => return Err("Unsupported method".to_string()),
    };

    match response {
        Ok(resp) => {
            let status_code = resp.status().as_u16();
            let body = resp.text().await.map_err(|e| e.to_string())?;

            // 大载荷检测：若响应体超过阈值，返回分片信封 + 第一块数据
            // 后续分片通过 fetch_chunk 逐块获取，避免一次性传输整块大 JSON
            if body.len() > CHUNK_THRESHOLD_BYTES {
                return Ok(serialize_chunked_response(status_code, &body));
            }

            Ok(serde_json::json!({
                "statusCode": status_code,
                "body": body,
            })
            .to_string())
        }
        Err(e) => Err(e.to_string()),
    }
}

/// 获取指定分片的内容
/// 渲染端收到分片信封后，依次调用此命令获取 chunk 1..N
#[tauri::command]
pub async fn fetch_chunk(
    channel_id: String,
    chunk_index: usize,
) -> Result<String, String> {
    let cache = CHUNK_CACHE.lock().map_err(|e| e.to_string())?;

    match cache.get(&channel_id) {
        Some(entry) => {
            if chunk_index >= entry.chunks.len() {
                return Err(format!(
                    "chunk_index {} out of range (total {} chunks)",
                    chunk_index,
                    entry.chunks.len()
                ));
            }
            Ok(entry.chunks[chunk_index].clone())
        }
        None => Err(format!(
            "chunk cache miss for channelId={}. Cache may have expired (TTL={}s)",
            channel_id, CHUNK_CACHE_TTL_SECS
        )),
    }
}

/// 将大载荷拆分为分片，缓存后返回信封 + 第一块
fn serialize_chunked_response(status_code: u16, body: &str) -> String {
    let total_chunks = (body.len() + CHUNK_SIZE_BYTES - 1) / CHUNK_SIZE_BYTES;

    // 拆分为分片
    let mut chunks: Vec<String> = Vec::with_capacity(total_chunks);
    let mut offset = 0;
    while offset < body.len() {
        let end = std::cmp::min(offset + CHUNK_SIZE_BYTES, body.len());
        chunks.push(body[offset..end].to_string());
        offset = end;
    }

    // 生成唯一 channelId
    let channel_id = format!(
        "chunk-{}-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        total_chunks
    );

    // 缓存全部分片（含第一块，渲染端从 index=1 开始 fetch）
    let first_chunk = chunks[0].clone();
    let mut cache = CHUNK_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    cleanup_chunk_cache(&mut cache);
    cache.insert(
        channel_id.clone(),
        CachedChunkedResponse {
            status_code,
            chunks,
            created_at: std::time::Instant::now(),
        },
    );

    // 返回信封：标记 __chunked=true，附带第一块数据
    // 渲染端检测到 __chunked 后，从 chunkIndex=1 开始逐块 fetch
    serde_json::json!({
        "__chunked": true,
        "statusCode": status_code,
        "channelId": channel_id,
        "totalChunks": total_chunks,
        "chunkIndex": 0,
        "data": first_chunk,
    })
    .to_string()
}

#[tauri::command]
pub async fn restart_backend(
    app: tauri::AppHandle,
    state: tauri::State<'_, GatewayState>,
) -> Result<String, String> {
    state.stop_child_best_effort();
    let base = state.resolve_base(&app).await?;
    Ok(format!("Gateway restarted: {base}"))
}
