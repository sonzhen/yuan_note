use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn setup_main_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_always_on_top(true)?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_edit_window(app: AppHandle, note_id: Option<String>) -> Result<(), String> {
    let (label, url_path) = match &note_id {
        Some(id) => (format!("edit-{}", id), format!("/edit/{}", id)),
        None => ("edit-new".to_string(), "/edit/new".to_string()),
    };

    // If window already exists, just focus it
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = WebviewUrl::App(url_path.into());
    WebviewWindowBuilder::new(&app, &label, url)
        .title("Edit Note")
        .inner_size(500.0, 450.0)
        .resizable(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn close_edit_window(app: AppHandle, note_id: Option<String>) -> Result<(), String> {
    let label = match &note_id {
        Some(id) => format!("edit-{}", id),
        None => "edit-new".to_string(),
    };

    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}
