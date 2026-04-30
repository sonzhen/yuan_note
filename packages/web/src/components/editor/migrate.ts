import { marked } from "marked";

export function migrateContent(content: string): string {
  if (!content || content.trim() === "") return "";
  if (content.trim().startsWith("<")) return content;
  return marked.parse(content, { async: false }) as string;
}
