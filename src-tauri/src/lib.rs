mod commands;
mod db;
mod hotkey;
mod models;
mod reminder;
mod tray;
mod window;

use db::Database;
use reminder::ReminderManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            let database = Database::new(app_dir).expect("failed to init database");

            // Load all existing reminders
            let reminder_manager = ReminderManager::new();
            {
                let conn = database.conn.lock().unwrap();
                reminder_manager.load_all(&conn);
            }

            // Set the app handle for notifications
            {
                let mut app_opt = reminder_manager.app.lock().unwrap();
                *app_opt = Some(app.handle().clone());
            }

            app.manage(database);
            app.manage(reminder_manager);

            let handle = app.handle();
            window::setup_main_window(handle)?;
            tray::setup_tray(handle)?;
            hotkey::setup_hotkey(handle)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_notes,
            commands::get_note,
            commands::create_note,
            commands::update_note,
            commands::delete_note,
            commands::reorder_notes,
            commands::search_notes,
            commands::get_tags,
            commands::create_tag,
            commands::delete_tag,
            commands::get_settings,
            commands::update_settings,
            commands::set_reminder,
            commands::cancel_reminder,
            window::open_edit_window,
            window::close_edit_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
