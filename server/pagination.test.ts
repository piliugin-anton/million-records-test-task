import { describe, expect, it, beforeEach } from "vitest";
import { getInitialAvailableCount, isInitialIdSelected, resetAvailability, setInitialSelected } from "./availability.js";
import { getAvailablePage, getSelectedPage } from "./pagination.js";
import {
  addItems,
  applySelection,
  createAppState
} from "./state.js";

describe("getSelectedPage", () => {
  beforeEach(() => {
    resetAvailability();
  });
  it("returns an unfiltered slice in selection order", () => {
    const state = createAppState();
    applySelection(state, ["3", "1", "2"], []);

    expect(getSelectedPage(state, "", 0, 2)).toEqual({
      items: ["3", "1"],
      total: 3
    });
  });

  it("filters selected ids by query using the trie", () => {
    const state = createAppState();
    addItems(state, ["alpha", "alphabet", "beta"]);
    applySelection(state, ["alpha", "alphabet", "beta"], []);

    expect(getSelectedPage(state, "alpha", 0, 10)).toEqual({
      items: ["alpha", "alphabet"],
      total: 2
    });
  });
});

describe("getAvailablePage", () => {
  beforeEach(() => {
    resetAvailability();
  });
  it("returns custom ids after the initial pool in append order", () => {
    const state = createAppState();
    addItems(state, ["custom-a", "custom-b"]);

    expect(getAvailablePage(state, "", 1_000_000, 10)).toEqual({
      items: ["custom-a", "custom-b"],
      total: 1_000_002
    });
  });

  it("filters custom available ids by query", () => {
    const state = createAppState();
    addItems(state, ["foo-1", "bar-2", "foo-3"]);

    expect(getAvailablePage(state, "foo", 0, 10)).toEqual({
      items: ["foo-1", "foo-3"],
      total: 2
    });
  });

  it("skips selected initial ids when filtering", () => {
    const state = createAppState();
    setInitialSelected(123, true);
    setInitialSelected(1123, true);

    const page = getAvailablePage(state, "123", 0, 10_000);
    expect(page.items).not.toContain("123");
    expect(page.items).not.toContain("1123");
    expect(page.total).toBeGreaterThan(0);
  });
});
