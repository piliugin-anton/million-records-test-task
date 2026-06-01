import { describe, expect, it, beforeEach } from "vitest";
import { getInitialAvailableCount, isInitialIdSelected, resetAvailability } from "./availability.js";
import {
  addItems,
  applyReorder,
  applySelection,
  createAppState,
  removeFromAddedAvailable,
  removeFromSelected
} from "./state.js";

describe("selection invariants", () => {
  beforeEach(() => {
    resetAvailability();
  });
  it("tracks selected positions with a map", () => {
    const state = createAppState();
    applySelection(state, ["10", "20", "30"], []);

    expect(state.selectedPosition.get("20")).toBe(1);

    applySelection(state, [], ["20"]);
    expect(state.selectedOrder).toEqual(["10", "30"]);
    expect(state.selectedPosition.get("30")).toBe(1);
    expect(state.selectedPosition.has("20")).toBe(false);
  });

  it("tracks addedAvailable positions with a map", () => {
    const state = createAppState();
    addItems(state, ["a", "b", "c"]);
    removeFromAddedAvailable(state, "b");

    expect(state.addedAvailable).toEqual(["a", "c"]);
    expect(state.addedAvailablePosition.get("c")).toBe(1);
  });

  it("updates availability count and bitmap for initial ids", () => {
    resetAvailability();
    const state = createAppState();

    applySelection(state, ["42"], []);
    expect(state.availableCount).toBe(999_999);
    expect(isInitialIdSelected(42)).toBe(true);
    expect(getInitialAvailableCount()).toBe(999_999);

    applySelection(state, [], ["42"]);
    expect(state.availableCount).toBe(1_000_000);
    expect(isInitialIdSelected(42)).toBe(false);
  });

  it("moves custom ids between available and selected indexes", () => {
    const state = createAppState();
    addItems(state, ["custom-1"]);
    expect(state.customAvailableIndex.search("custom").has("custom-1")).toBe(true);

    applySelection(state, ["custom-1"], []);
    expect(state.customAvailableIndex.search("custom").has("custom-1")).toBe(false);
    expect(state.selectedIndex.search("custom").has("custom-1")).toBe(true);

    applySelection(state, [], ["custom-1"]);
    expect(state.customAvailableIndex.search("custom").has("custom-1")).toBe(true);
    expect(state.selectedIndex.search("custom").has("custom-1")).toBe(false);
  });

  it("rebuilds selected positions after reorder", () => {
    const state = createAppState();
    applySelection(state, ["1", "2", "3", "4"], []);

    applyReorder(state, ["4", "2"]);
    expect(state.selectedOrder).toEqual(["1", "4", "3", "2"]);
    expect(state.selectedPosition.get("4")).toBe(1);
    expect(state.selectedPosition.get("1")).toBe(0);
  });

  it("removeFromSelected updates positions after middle removal", () => {
    const state = createAppState();
    addItems(state, ["a", "b", "c"]);
    applySelection(state, ["a", "b", "c"], []);
    removeFromSelected(state, "b");

    expect(state.selectedOrder).toEqual(["a", "c"]);
    expect(state.selectedPosition.get("c")).toBe(1);
  });
});
