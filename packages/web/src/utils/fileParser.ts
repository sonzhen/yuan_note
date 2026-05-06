import mammoth from "mammoth";
import { marked } from "marked";

export interface ParsedFile {
  title: string;
  html: string;
}

function extractTitle(filename: string): string {
  return filename.replace(/\.(docx|md)$/i, "");
}

async function parseDocx(file: File): Promise<ParsedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return { title: extractTitle(file.name), html: result.value };
}

async function parseMarkdown(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const html = await marked(text);
  return { title: extractTitle(file.name), html };
}

export interface ParseResult {
  success: ParsedFile[];
  failed: string[];
  skipped: string[];
}

export async function parseFiles(files: File[]): Promise<ParseResult> {
  const success: ParsedFile[] = [];
  const failed: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "docx") {
      try {
        const parsed = await parseDocx(file);
        success.push(parsed);
      } catch {
        failed.push(file.name);
      }
    } else if (ext === "md") {
      try {
        const parsed = await parseMarkdown(file);
        success.push(parsed);
      } catch {
        failed.push(file.name);
      }
    } else {
      skipped.push(file.name);
    }
  }

  return { success, failed, skipped };
}
