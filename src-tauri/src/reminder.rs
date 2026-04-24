use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
use tokio::task::JoinHandle;

pub struct ReminderManager {
    handles: Mutex<HashMap<String, JoinHandle<()>>>,
    pub app: Mutex<Option<AppHandle>>,
}

impl ReminderManager {
    pub fn new() -> Self {
        ReminderManager {
            handles: Mutex::new(HashMap::new()),
            app: Mutex::new(None),
        }
    }

    pub fn schedule(&self, note_id: String, title: String, due_at_str: &str) {
        // Cancel existing reminder for this note if any
        self.cancel(&note_id);

        let due = match chrono::NaiveDateTime::parse_from_str(due_at_str, "%Y-%m-%d %H:%M:%S") {
            Ok(dt) => dt,
            Err(_) => {
                // Try ISO 8601 format
                match chrono::NaiveDateTime::parse_from_str(due_at_str, "%Y-%m-%dT%H:%M:%S") {
                    Ok(dt) => dt,
                    Err(_) => return,
                }
            }
        };

        let now = chrono::Local::now().naive_local();
        let duration = due.signed_duration_since(now);

        if duration.num_milliseconds() <= 0 {
            return; // Already past
        }

        let sleep_duration =
            std::time::Duration::from_millis(duration.num_milliseconds() as u64);

        let app_handle = {
            let guard = self.app.lock().unwrap();
            match guard.as_ref() {
                Some(h) => h.clone(),
                None => return,
            }
        };

        let note_id_clone = note_id.clone();
        let handle = tokio::spawn(async move {
            tokio::time::sleep(sleep_duration).await;
            let _ = app_handle
                .notification()
                .builder()
                .title("MemoWidget Reminder")
                .body(&format!("Reminder: {}", title))
                .show();

            // Emit event so frontend can react
            let _ = app_handle.emit("reminder-fired", &note_id_clone);
        });

        let mut handles = self.handles.lock().unwrap();
        handles.insert(note_id, handle);
    }

    pub fn cancel(&self, note_id: &str) {
        let mut handles = self.handles.lock().unwrap();
        if let Some(handle) = handles.remove(note_id) {
            handle.abort();
        }
    }

    pub fn load_all(&self, conn: &rusqlite::Connection) {
        let mut stmt = match conn
            .prepare("SELECT id, title, due_at FROM notes WHERE due_at IS NOT NULL")
        {
            Ok(s) => s,
            Err(_) => return,
        };

        let rows: Vec<(String, String, String)> = match stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        {
            Ok(mapped) => mapped.filter_map(|r| r.ok()).collect(),
            Err(_) => Vec::new(),
        };

        for (id, title, due_at) in rows {
            self.schedule(id, title, &due_at);
        }
    }
}
