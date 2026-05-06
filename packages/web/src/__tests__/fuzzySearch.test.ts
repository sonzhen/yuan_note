import { describe, it, expect } from "vitest";
import { matchNote } from "../utils/fuzzySearch";

describe("matchNote", () => {
  describe("token-based matching", () => {
    it("matches single token in title", () => {
      expect(matchNote("工作规划", "some content", "规划")).toBe(true);
    });

    it("matches single token in content", () => {
      expect(matchNote("title", "这是工作规划的内容", "规划")).toBe(true);
    });

    it("requires ALL tokens to match (AND logic)", () => {
      expect(matchNote("工作规划", "详细内容", "工作 规划")).toBe(true);
      expect(matchNote("工作规划", "详细内容", "工作 不存在")).toBe(false);
    });

    it("tokens can match across title and content", () => {
      expect(matchNote("工作", "规划细节", "工作 规划")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(matchNote("Hello World", "content", "hello")).toBe(true);
      expect(matchNote("title", "Hello World", "HELLO")).toBe(true);
    });

    it("returns true for empty query", () => {
      expect(matchNote("anything", "content", "")).toBe(true);
      expect(matchNote("anything", "content", "   ")).toBe(true);
    });

    it("does not match when no token found", () => {
      expect(matchNote("工作规划", "详细内容", "旅游")).toBe(false);
    });
  });

  describe("pinyin matching", () => {
    it("matches pinyin initials of title", () => {
      expect(matchNote("工作规划", "", "gzgh")).toBe(true);
    });

    it("matches partial pinyin initials", () => {
      expect(matchNote("工作规划", "", "gz")).toBe(true);
    });

    it("matches full pinyin of title", () => {
      expect(matchNote("工作", "", "gongzuo")).toBe(true);
    });

    it("does not match pinyin of content (too expensive)", () => {
      expect(matchNote("unrelated", "工作规划", "gzgh")).toBe(false);
    });

    it("pinyin match is case-insensitive for query", () => {
      expect(matchNote("工作规划", "", "GZGH")).toBe(true);
    });
  });

  describe("combined matching", () => {
    it("matches if token match succeeds (pinyin not needed)", () => {
      expect(matchNote("工作规划", "", "工作")).toBe(true);
    });

    it("falls through to pinyin if token match fails", () => {
      expect(matchNote("工作规划", "some content", "gz")).toBe(true);
    });

    it("returns false if neither layer matches", () => {
      expect(matchNote("工作规划", "详细内容", "xyz")).toBe(false);
    });
  });
});
