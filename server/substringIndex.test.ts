import { describe, expect, it } from "vitest";
import { SubstringIndex, InitialNumericSubstringIndex } from "./substringIndex.js";

describe("SubstringIndex", () => {
  it("finds ids containing a substring", () => {
    const index = new SubstringIndex();
    index.insert("123");
    index.insert("456");
    index.insert("1423");

    expect([...index.search("23")].sort()).toEqual(["123", "1423"]);
    expect(index.search("99").size).toBe(0);
  });

  it("supports insert and remove", () => {
    const index = new SubstringIndex();
    index.insert("abc");
    index.insert("xabcy");

    expect(index.search("abc").size).toBe(2);
    index.remove("abc");
    expect([...index.search("abc")]).toEqual(["xabcy"]);
  });

  it("returns empty set for empty query", () => {
    const index = new SubstringIndex();
    index.insert("123");
    expect(index.search("").size).toBe(0);
  });
});

describe("InitialNumericSubstringIndex", () => {
  it("returns matching ids in ascending numeric order", () => {
    const index = new InitialNumericSubstringIndex();
    index.build(1000);

    expect(index.getMatchingNumbers("999")).toEqual([999]);
    expect(index.getMatchingNumbers("23")).toEqual([
      23, 123, 223, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 323, 423, 523, 623, 723, 823, 923
    ]);
  });
});

describe("InitialNumericSubstringIndex @slow", () => {
  it("builds the full index and finds a specific match quickly", () => {
    const index = new InitialNumericSubstringIndex();
    const started = performance.now();
    index.build(1_000_000);
    const buildMs = performance.now() - started;

    const lookupStarted = performance.now();
    const matches = index.getMatchingNumbers("999999");
    const lookupMs = performance.now() - lookupStarted;

    expect(matches).toEqual([999999]);
    expect(buildMs).toBeLessThan(30_000);
    expect(lookupMs).toBeLessThan(50);
  });
});
