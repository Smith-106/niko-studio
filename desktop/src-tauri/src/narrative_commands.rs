use tauri::State;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// === 数据结构 ===

#[derive(Serialize, Deserialize, Clone)]
pub struct QualityReport {
    overall: u32,
    dimensions: std::collections::HashMap<String, u32>,
    critical_issues: Vec<String>,
    suggestions: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ForeshadowAlert {
    foreshadow_id: String,
    hint: String,
    planted_at: u32,
    current_chapter: u32,
    chapters_until_due: i32,
    urgency: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct WritingContext {
    entities: Vec<serde_json::Value>,
    recent_memories: Vec<serde_json::Value>,
    pending_foreshadows: Vec<ForeshadowAlert>,
    crystal_pages: Vec<serde_json::Value>,
    contradictions: Vec<serde_json::Value>,
    last_quality_score: Option<u32>,
    suggestions: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RoleAnalysis {
    role_id: String,
    role_name: String,
    findings: Vec<serde_json::Value>,
    weighted_score: u32,
}

// === 应用状态 ===

pub struct AppState {
    pub current_chapter: Mutex<u32>,
    pub quality_cache: Mutex<Option<QualityReport>>,
    pub foreshadow_cache: Mutex<Vec<ForeshadowAlert>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current_chapter: Mutex::new(1),
            quality_cache: Mutex::new(None),
            foreshadow_cache: Mutex::new(Vec::new()),
        }
    }
}

// === Tauri Commands ===

#[tauri::command]
pub fn get_current_chapter(state: State<AppState>) -> Result<u32, String> {
    state.current_chapter.lock().map(|c| *c).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_current_chapter(state: State<AppState>, chapter: u32) -> Result<(), String> {
    state.current_chapter.lock().map(|mut c| *c = chapter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn analyze_quality(text: String) -> Result<QualityReport, String> {
    // 委托给 TypeScript 侧的 NarrativeAnalyzer，通过 sidecar 调用
    // 这里提供基础的关键词分析作为 fallback
    let mut dimensions = std::collections::HashMap::new();

    let has_conflict = text.contains("但") || text.contains("却") || text.contains("然而");
    let has_mystery = text.contains("秘密") || text.contains("真相") || text.contains("谜");
    let has_emotion = text.contains("感到") || text.contains("颤抖") || text.contains("心跳");
    let has_suspense = text.contains("危险") || text.contains("威胁") || text.contains("逼近");

    dimensions.insert("hook".to_string(), if has_conflict { 70 } else { 25 });
    dimensions.insert("cliffhanger".to_string(), if has_mystery { 65 } else { 20 });
    dimensions.insert("emotion_craft".to_string(), if has_emotion { 60 } else { 25 });
    dimensions.insert("suspense".to_string(), if has_suspense { 65 } else { 20 });

    let overall = dimensions.values().sum::<u32>() / dimensions.len().max(1) as u32;

    let mut critical_issues = Vec::new();
    let mut suggestions = Vec::new();
    if overall < 40 {
        critical_issues.push("整体叙事质量偏低".to_string());
        suggestions.push("加入冲突、悬念或信息缺口增强吸引力".to_string());
    }
    if !has_emotion {
        suggestions.push("增加感官细节和身体反应提升情感工艺".to_string());
    }

    Ok(QualityReport { overall, dimensions, critical_issues, suggestions })
}

#[tauri::command]
pub fn get_foreshadow_alerts(state: State<AppState>, chapter: u32) -> Result<Vec<ForeshadowAlert>, String> {
    let cache = state.foreshadow_cache.lock().map_err(|e| e.to_string())?;
    Ok(cache.iter().filter(|a| {
        a.urgency == "due" || a.urgency == "overdue" || a.chapters_until_due <= 20
    }).cloned().collect())
}

#[tauri::command]
pub fn add_foreshadow(state: State<AppState>, hint: String, planted_chapter: u32, max_distance: u32) -> Result<String, String> {
    let id = format!("f-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0"));
    let current = *state.current_chapter.lock().map_err(|e| e.to_string())?;
    let chapters_until_due = max_distance as i32 - (current as i32 - planted_chapter as i32);
    let urgency = if chapters_until_due <= 0 { "overdue" } else if chapters_until_due <= 10 { "due" } else { "approaching" };

    let alert = ForeshadowAlert {
        foreshadow_id: id.clone(),
        hint,
        planted_at: planted_chapter,
        current_chapter: current,
        chapters_until_due,
        urgency: urgency.to_string(),
    };

    state.foreshadow_cache.lock().map(|mut cache| cache.push(alert)).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn resolve_foreshadow(state: State<AppState>, id: String) -> Result<(), String> {
    let mut cache = state.foreshadow_cache.lock().map_err(|e| e.to_string())?;
    cache.retain(|a| a.foreshadow_id != id);
    Ok(())
}

#[tauri::command]
pub fn get_nowledge_status() -> Result<serde_json::Value, String> {
    // 检查 Nowledge Mem 是否在线
    Ok(serde_json::json!({
        "online": false,
        "host": "127.0.0.1",
        "port": 19828,
        "pending_conflicts": 0
    }))
}

#[tauri::command]
pub fn sync_from_knowledge_layer() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "pushed": 0, "pulled": 0, "conflicts": 0, "errors": ["Knowledge layer offline"]
    }))
}
