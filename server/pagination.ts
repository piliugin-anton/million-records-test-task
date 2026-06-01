import {
  getInitialAvailableCount,
  getInitialAvailablePage,
  isInitialIdSelected
} from "./availability.js";
import { getInitialIdsMatching } from "./initialSubstringIndex.js";
import type { AppState } from "./state.js";

export type PageResult = {
  items: string[];
  total: number;
};

export function getSelectedPage(
  state: AppState,
  query: string,
  offset: number,
  limit: number
): PageResult {
  if (query === "") {
    return {
      items: state.selectedOrder.slice(offset, offset + limit),
      total: state.selectedOrder.length
    };
  }

  const matchSet = state.selectedIndex.search(query);
  const items: string[] = [];
  let skipped = 0;
  let total = 0;

  for (const id of state.selectedOrder) {
    if (!matchSet.has(id)) continue;
    total += 1;
    if (skipped < offset) {
      skipped += 1;
      continue;
    }
    if (items.length < limit) items.push(id);
  }

  return { items, total };
}

export function getAvailablePageUnfiltered(state: AppState, offset: number, limit: number): PageResult {
  const initialAvailable = getInitialAvailableCount();
  const items: string[] = [];

  if (offset < initialAvailable) {
    const fromInitial = getInitialAvailablePage(offset, Math.min(limit, initialAvailable - offset));
    items.push(...fromInitial);
  }

  if (items.length < limit) {
    const customOffset = Math.max(0, offset - initialAvailable);
    items.push(...state.addedAvailable.slice(customOffset, customOffset + (limit - items.length)));
  }

  return { items, total: state.availableCount };
}

export function getAvailablePage(
  state: AppState,
  query: string,
  offset: number,
  limit: number
): PageResult {
  if (query === "") {
    return getAvailablePageUnfiltered(state, offset, limit);
  }

  const customMatchSet = state.customAvailableIndex.search(query);
  const items: string[] = [];
  let skipped = 0;
  let total = 0;

  for (const numberId of getInitialIdsMatching(query)) {
    if (isInitialIdSelected(numberId)) continue;
    total += 1;
    if (skipped < offset) {
      skipped += 1;
      continue;
    }
    if (items.length < limit) items.push(String(numberId));
  }

  for (const id of state.addedAvailable) {
    if (!customMatchSet.has(id)) continue;
    total += 1;
    if (skipped < offset) {
      skipped += 1;
      continue;
    }
    if (items.length < limit) items.push(id);
  }

  return { items, total };
}
