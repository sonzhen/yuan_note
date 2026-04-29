export interface User {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  owner_id: string;
  shared: boolean;
  type: string;
  title: string;
  content: string;
  is_done: boolean;
  due_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  tag_ids: string[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface PendingChange {
  id: string;
  action: "create" | "update" | "delete";
  entity: "note" | "tag";
  entity_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}
