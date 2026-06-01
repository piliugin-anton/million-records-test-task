import { describe, expect, it } from "vitest";
import {
  buildFetchChunks,
  indexOverlapsRange,
  pageOverlapsRange,
  rangeOverlapsRequest,
  removeIdFromCache
} from "./pagingHelpers.js";

describe("pagingHelpers", () => {
  it("builds fetch chunks capped at MAX_FETCH_SIZE", () => {
    expect(buildFetchChunks(0, 4)).toEqual([
      { offset: 0, limit: 100, pages: [0, 1, 2, 3, 4] }
    ]);
  });

  it("detects overlapping ranges", () => {
    expect(pageOverlapsRange(1, 10, 29)).toBe(true);
    expect(pageOverlapsRange(5, 0, 9)).toBe(false);
    expect(rangeOverlapsRequest(10, 29, 0, 20)).toBe(true);
    expect(indexOverlapsRange(15, 10, 29)).toBe(true);
  });

  it("removes an id and shifts later cache entries", () => {
    const cache = { 0: "a", 1: "b", 2: "c" };
    const { next, removedIndex } = removeIdFromCache(cache, "b");

    expect(removedIndex).toBe(1);
    expect(next).toEqual({ 0: "a", 1: "c" });
  });
});
