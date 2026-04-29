interface Env {
  DB: D1Database;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

export async function handleReminders(env: Env): Promise<void> {
  const now = new Date().toISOString();

  const { results: dueNotes } = await env.DB.prepare(
    `SELECT n.id, n.title, n.owner_id
     FROM notes n
     WHERE n.due_at IS NOT NULL AND n.due_at <= ? AND n.deleted_at IS NULL AND n.is_done = 0`
  ).bind(now).all();

  if (!dueNotes || dueNotes.length === 0) return;

  for (const note of dueNotes) {
    const { results: subs } = await env.DB.prepare(
      "SELECT subscription FROM push_subscriptions WHERE user_id = ?"
    ).bind(note.owner_id as string).all();

    if (subs) {
      for (const sub of subs) {
        try {
          const subscription = JSON.parse(sub.subscription as string);
          const payload = JSON.stringify({
            title: "提醒",
            body: note.title as string,
            data: { noteId: note.id },
          });
          await fetch(subscription.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          });
        } catch (err) {
          console.error("Push failed:", err);
        }
      }
    }

    await env.DB.prepare("UPDATE notes SET due_at = NULL, updated_at = datetime('now') WHERE id = ?")
      .bind(note.id as string).run();
  }
}
