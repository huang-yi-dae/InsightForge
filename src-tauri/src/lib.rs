// InsightForge 桌面客户端（Tauri 2）。
// 前端为 Next.js 静态导出产物（../out），全程 BYOK 前端直连，无需服务端。

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running InsightForge desktop application");
}
