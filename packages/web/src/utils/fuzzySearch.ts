import { pinyin } from "pinyin-pro";

export function matchNote(
  title: string,
  content: string,
  query: string
): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();

  const tokenMatch = tokens.every(
    (t) => titleLower.includes(t) || contentLower.includes(t)
  );
  if (tokenMatch) return true;

  const titlePinyin = pinyin(title, { pattern: "first", toneType: "none", type: "array" }).join("");
  const titlePinyinFull = pinyin(title, { toneType: "none", type: "array" }).join("");

  const pinyinMatch = tokens.every(
    (t) => titlePinyin.includes(t) || titlePinyinFull.includes(t)
  );

  return pinyinMatch;
}
