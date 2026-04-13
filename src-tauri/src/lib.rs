// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Checks whether a file exists at the given absolute path.
/// Uses Rust's std::path directly so no fs plugin scope is required.
#[tauri::command]
fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

/// Creates an empty file at the given absolute path (or truncates if it exists).
#[tauri::command]
fn create_empty_file(path: String) -> Result<(), String> {
    std::fs::File::create(&path)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Creates a backup copy of `file_path` at `backup_path`, then prunes any
/// `{basename}.*.bak` files in the same directory beyond the 2 most recent.
/// `backup_path` is expected to already be computed by the caller (e.g. JS).
#[tauri::command]
fn run_startup_backup(file_path: String, backup_path: String) -> Result<(), String> {
    use std::path::Path;

    let source = Path::new(&file_path);

    // Copy to backup (overwrites if today's backup already exists).
    std::fs::copy(source, &backup_path)
        .map_err(|e| format!("backup copy failed: {}", e))?;

    // Prune: list all {basename}.*.bak files, keep 2 most recent.
    let parent = source.parent().ok_or("no parent directory")?;
    let base_name = source
        .file_name()
        .ok_or("no file name")?
        .to_string_lossy()
        .to_string();
    let prefix = format!("{}.", base_name);

    let mut bak_files: Vec<String> = std::fs::read_dir(parent)
        .map_err(|e| format!("read_dir failed: {}", e))?
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|name| name.starts_with(&prefix) && name.ends_with(".bak"))
        .collect();

    bak_files.sort_by(|a, b| b.cmp(a)); // descending → most recent first

    for old in bak_files.iter().skip(2) {
        let _ = std::fs::remove_file(parent.join(old)); // ignore individual errors
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet, file_exists, create_empty_file, run_startup_backup])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
