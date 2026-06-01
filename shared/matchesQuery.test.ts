import { describe, expect, it } from "vitest";
import { matchesQuery } from "./matchesQuery.js";

describe("matchesQuery", () => {
  it("matches every id when query is empty", () => {
    expect(matchesQuery("123", "")).toBe(true);
    expect(matchesQuery("abc", "")).toBe(true);
  });

  it("matches substring occurrences", () => {
    expect(matchesQuery("12345", "234")).toBe(true);
    expect(matchesQuery("12345", "999")).toBe(false);
  });
});
