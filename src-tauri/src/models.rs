use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    #[serde(rename = "type")]
    pub note_type: String,
    pub title: String,
    pub content: String,
    pub is_done: bool,
    pub due_at: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateNote {
    #[serde(rename = "type")]
    pub note_type: String,
    pub title: String,
    pub content: Option<String>,
    pub tag_ids: Option<Vec<String>>,
    pub due_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNote {
    pub title: Option<String>,
    pub content: Option<String>,
    #[serde(rename = "type")]
    pub note_type: Option<String>,
    pub is_done: Option<bool>,
    pub due_at: Option<String>,
    pub tag_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct NoteFilter {
    pub note_type: Option<String>,
    pub tag_id: Option<String>,
    pub is_done: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub hotkey: String,
    pub opacity: f64,
    pub auto_start: bool,
    pub accent_color: String,
}
