use crate::db::Database;
use crate::models::*;
use crate::reminder::ReminderManager;
use tauri::State;
use uuid::Uuid;

fn load_tags_for_note(conn: &rusqlite::Connection, note_id: &str) -> Vec<Tag> {
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, t.color FROM tags t
             INNER JOIN note_tags nt ON nt.tag_id = t.id
             WHERE nt.note_id = ?1",
        )
        .unwrap();
    stmt.query_map([note_id], |row| {
        Ok(Tag {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}

fn query_single_note(conn: &rusqlite::Connection, note_id: &str) -> Result<Note, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, type, title, content, is_done, due_at, sort_order, created_at, updated_at
             FROM notes WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let note = stmt
        .query_row([note_id], |row| {
            let id: String = row.get(0)?;
            Ok(Note {
                id: id.clone(),
                note_type: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                is_done: row.get::<_, i32>(4)? != 0,
                due_at: row.get(5)?,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                tags: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;

    let tags = load_tags_for_note(conn, &note.id);
    Ok(Note { tags, ..note })
}

#[tauri::command]
pub fn get_notes(db: State<Database>, filter: NoteFilter) -> Result<Vec<Note>, String> {
    let conn = db.conn.lock().unwrap();

    let mut sql = String::from(
        "SELECT id, type, title, content, is_done, due_at, sort_order, created_at, updated_at FROM notes",
    );
    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref note_type) = filter.note_type {
        conditions.push(format!("type = ?{}", params.len() + 1));
        params.push(Box::new(note_type.clone()));
    }
    if let Some(ref is_done) = filter.is_done {
        conditions.push(format!("is_done = ?{}", params.len() + 1));
        params.push(Box::new(*is_done as i32));
    }
    if let Some(ref tag_id) = filter.tag_id {
        conditions.push(format!(
            "id IN (SELECT note_id FROM note_tags WHERE tag_id = ?{})",
            params.len() + 1
        ));
        params.push(Box::new(tag_id.clone()));
    }

    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }
    sql.push_str(" ORDER BY sort_order ASC");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let notes = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(Note {
                id: row.get(0)?,
                note_type: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                is_done: row.get::<_, i32>(4)? != 0,
                due_at: row.get(5)?,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                tags: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<Note>>();

    let notes = notes
        .into_iter()
        .map(|note| {
            let tags = load_tags_for_note(&conn, &note.id);
            Note { tags, ..note }
        })
        .collect();

    Ok(notes)
}

#[tauri::command]
pub fn get_note(db: State<Database>, id: String) -> Result<Note, String> {
    let conn = db.conn.lock().unwrap();
    query_single_note(&conn, &id)
}

#[tauri::command]
pub fn create_note(db: State<Database>, input: CreateNote) -> Result<Note, String> {
    let conn = db.conn.lock().unwrap();
    let id = Uuid::new_v4().to_string();

    let max_order: i32 = conn
        .query_row("SELECT COALESCE(MAX(sort_order), 0) FROM notes", [], |row| {
            row.get(0)
        })
        .map_err(|e| e.to_string())?;

    let sort_order = max_order + 1;
    let content = input.content.unwrap_or_default();

    conn.execute(
        "INSERT INTO notes (id, type, title, content, due_at, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, input.note_type, input.title, content, input.due_at, sort_order],
    )
    .map_err(|e| e.to_string())?;

    if let Some(tag_ids) = &input.tag_ids {
        for tag_id in tag_ids {
            conn.execute(
                "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
                rusqlite::params![id, tag_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    query_single_note(&conn, &id)
}

#[tauri::command]
pub fn update_note(db: State<Database>, id: String, input: UpdateNote) -> Result<Note, String> {
    let conn = db.conn.lock().unwrap();

    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref title) = input.title {
        params.push(Box::new(title.clone()));
        sets.push(format!("title = ?{}", params.len()));
    }
    if let Some(ref content) = input.content {
        params.push(Box::new(content.clone()));
        sets.push(format!("content = ?{}", params.len()));
    }
    if let Some(ref note_type) = input.note_type {
        params.push(Box::new(note_type.clone()));
        sets.push(format!("type = ?{}", params.len()));
    }
    if let Some(is_done) = input.is_done {
        params.push(Box::new(is_done as i32));
        sets.push(format!("is_done = ?{}", params.len()));
    }
    if let Some(ref due_at) = input.due_at {
        params.push(Box::new(due_at.clone()));
        sets.push(format!("due_at = ?{}", params.len()));
    }

    if !sets.is_empty() {
        sets.push(format!("updated_at = datetime('now')"));
        params.push(Box::new(id.clone()));
        let sql = format!(
            "UPDATE notes SET {} WHERE id = ?{}",
            sets.join(", "),
            params.len()
        );
        let param_refs: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|p| p.as_ref()).collect();
        conn.execute(&sql, param_refs.as_slice())
            .map_err(|e| e.to_string())?;
    }

    if let Some(ref tag_ids) = input.tag_ids {
        conn.execute(
            "DELETE FROM note_tags WHERE note_id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;
        for tag_id in tag_ids {
            conn.execute(
                "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
                rusqlite::params![id, tag_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    query_single_note(&conn, &id)
}

#[tauri::command]
pub fn delete_note(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM notes WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn reorder_notes(db: State<Database>, ids: Vec<String>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    for (index, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE notes SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![index as i32, id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn search_notes(db: State<Database>, query: String) -> Result<Vec<Note>, String> {
    let conn = db.conn.lock().unwrap();
    let pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare(
            "SELECT id, type, title, content, is_done, due_at, sort_order, created_at, updated_at
             FROM notes WHERE title LIKE ?1 OR content LIKE ?1
             ORDER BY sort_order ASC",
        )
        .map_err(|e| e.to_string())?;

    let notes = stmt
        .query_map([&pattern], |row| {
            Ok(Note {
                id: row.get(0)?,
                note_type: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                is_done: row.get::<_, i32>(4)? != 0,
                due_at: row.get(5)?,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                tags: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<Note>>();

    let notes = notes
        .into_iter()
        .map(|note| {
            let tags = load_tags_for_note(&conn, &note.id);
            Note { tags, ..note }
        })
        .collect();

    Ok(notes)
}

#[tauri::command]
pub fn get_tags(db: State<Database>) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, color FROM tags ORDER BY name ASC")
        .map_err(|e| e.to_string())?;
    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(tags)
}

#[tauri::command]
pub fn create_tag(db: State<Database>, name: String, color: String) -> Result<Tag, String> {
    let conn = db.conn.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
        rusqlite::params![id, name, color],
    )
    .map_err(|e| e.to_string())?;
    Ok(Tag { id, name, color })
}

#[tauri::command]
pub fn delete_tag(db: State<Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM tags WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_settings(db: State<Database>) -> Result<AppSettings, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut hotkey = String::from("Ctrl+Shift+M");
    let mut opacity = 1.0;
    let mut auto_start = false;
    let mut accent_color = String::from("#e94560");

    for (key, value) in rows {
        match key.as_str() {
            "hotkey" => hotkey = value,
            "opacity" => opacity = value.parse().unwrap_or(1.0),
            "auto_start" => auto_start = value == "true",
            "accent_color" => accent_color = value,
            _ => {}
        }
    }

    Ok(AppSettings {
        hotkey,
        opacity,
        auto_start,
        accent_color,
    })
}

#[tauri::command]
pub fn update_settings(db: State<Database>, settings: AppSettings) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let pairs: Vec<(&str, String)> = vec![
        ("hotkey", settings.hotkey),
        ("opacity", settings.opacity.to_string()),
        ("auto_start", settings.auto_start.to_string()),
        ("accent_color", settings.accent_color),
    ];
    for (key, value) in pairs {
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![key, value],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_reminder(
    db: State<Database>,
    reminders: State<ReminderManager>,
    note_id: String,
    due_at: String,
) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "UPDATE notes SET due_at = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![due_at, note_id],
    )
    .map_err(|e| e.to_string())?;

    let title: String = conn
        .query_row(
            "SELECT title FROM notes WHERE id = ?1",
            rusqlite::params![note_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    reminders.schedule(note_id, title, &due_at);
    Ok(())
}

#[tauri::command]
pub fn cancel_reminder(
    db: State<Database>,
    reminders: State<ReminderManager>,
    note_id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "UPDATE notes SET due_at = NULL, updated_at = datetime('now') WHERE id = ?1",
        rusqlite::params![note_id],
    )
    .map_err(|e| e.to_string())?;

    reminders.cancel(&note_id);
    Ok(())
}
