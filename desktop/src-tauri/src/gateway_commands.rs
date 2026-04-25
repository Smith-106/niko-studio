use crate::gateway_runtime::{is_gateway_healthy, GatewayState};

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
            Ok(serde_json::json!({
                "statusCode": status_code,
                "body": body,
            })
            .to_string())
        }
        Err(e) => Err(e.to_string()),
    }
}
