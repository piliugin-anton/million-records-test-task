import { INITIAL_COUNT, setInitialSelected, resetAvailability } from "./availability.js";
import { SubstringIndex } from "./substringIndex.js";
import { isInitialId } from "./listQuery.js";

export type AppState = {
  addedIds: Set<string>;
  addedAvailable: string[];
  addedAvailablePosition: Map<string, number>;
  selectedOrder: string[];
  selectedPosition: Map<string, number>;
  selectedSet: Set<string>;
  availableCount: number;
  customAvailableIndex: SubstringIndex;
  selectedIndex: SubstringIndex;
};

export function createAppState(): AppState {
  return {
    addedIds: new Set(),
    addedAvailable: [],
    addedAvailablePosition: new Map(),
    selectedOrder: [],
    selectedPosition: new Map(),
    selectedSet: new Set(),
    availableCount: INITIAL_COUNT,
    customAvailableIndex: new SubstringIndex(),
    selectedIndex: new SubstringIndex()
  };
}

export function itemExists(state: AppState, id: string): boolean {
  return isInitialId(id) || state.addedIds.has(id);
}

function rebuildSelectedPosition(state: AppState): void {
  state.selectedPosition.clear();
  state.selectedOrder.forEach((id, index) => {
    state.selectedPosition.set(id, index);
  });
}

function rebuildAddedAvailablePosition(state: AppState): void {
  state.addedAvailablePosition.clear();
  state.addedAvailable.forEach((id, index) => {
    state.addedAvailablePosition.set(id, index);
  });
}

export function appendToAddedAvailable(state: AppState, id: string): void {
  state.addedAvailable.push(id);
  state.addedAvailablePosition.set(id, state.addedAvailable.length - 1);
  state.customAvailableIndex.insert(id);
}

export function removeFromAddedAvailable(state: AppState, id: string): void {
  const index = state.addedAvailablePosition.get(id);
  if (index === undefined) return;

  state.addedAvailable.splice(index, 1);
  state.addedAvailablePosition.delete(id);
  state.customAvailableIndex.remove(id);

  for (let position = index; position < state.addedAvailable.length; position += 1) {
    state.addedAvailablePosition.set(state.addedAvailable[position], position);
  }
}

export function appendToSelected(state: AppState, id: string): void {
  state.selectedOrder.push(id);
  state.selectedPosition.set(id, state.selectedOrder.length - 1);
  state.selectedIndex.insert(id);
}

export function removeFromSelected(state: AppState, id: string): void {
  const index = state.selectedPosition.get(id);
  if (index === undefined) return;

  state.selectedOrder.splice(index, 1);
  state.selectedPosition.delete(id);
  state.selectedIndex.remove(id);

  for (let position = index; position < state.selectedOrder.length; position += 1) {
    state.selectedPosition.set(state.selectedOrder[position], position);
  }
}

export function addItems(state: AppState, ids: string[]): { added: string[]; skipped: string[] } {
  const seenInRequest = new Set<string>();
  const added: string[] = [];
  const skipped: string[] = [];

  for (const value of ids) {
    const id = String(value ?? "").trim();
    if (!id || seenInRequest.has(id) || itemExists(state, id)) {
      if (id) skipped.push(id);
      continue;
    }

    seenInRequest.add(id);
    state.addedIds.add(id);
    added.push(id);
    if (!state.selectedSet.has(id)) {
      state.availableCount += 1;
      if (!isInitialId(id)) {
        appendToAddedAvailable(state, id);
      }
    }
  }

  return { added, skipped };
}

export function applySelection(
  state: AppState,
  select: string[],
  unselect: string[]
): number {
  for (const value of unselect) {
    const id = String(value ?? "").trim();
    if (!id || !state.selectedSet.has(id)) continue;

    state.selectedSet.delete(id);
    removeFromSelected(state, id);
    state.availableCount += 1;

    if (isInitialId(id)) {
      setInitialSelected(Number(id), false);
    } else if (state.addedIds.has(id)) {
      appendToAddedAvailable(state, id);
    }
  }

  for (const value of select) {
    const id = String(value ?? "").trim();
    if (!id || !itemExists(state, id) || state.selectedSet.has(id)) continue;

    state.selectedSet.add(id);
    appendToSelected(state, id);
    state.availableCount -= 1;

    if (isInitialId(id)) {
      setInitialSelected(Number(id), true);
    } else {
      removeFromAddedAvailable(state, id);
    }
  }

  return state.selectedOrder.length;
}

export function applyReorder(state: AppState, orderedIds: string[]): number {
  const uniqueOrderedIds = [...new Set(orderedIds)].filter((id) => state.selectedSet.has(id));
  const replacementPositions: number[] = [];
  const movingIds = new Set(uniqueOrderedIds);

  state.selectedOrder.forEach((id, index) => {
    if (movingIds.has(id)) replacementPositions.push(index);
  });

  replacementPositions.forEach((position, index) => {
    state.selectedOrder[position] = uniqueOrderedIds[index];
  });

  rebuildSelectedPosition(state);
  return state.selectedOrder.length;
}

export function resetAppState(state: AppState): void {
  state.addedIds.clear();
  state.addedAvailable.length = 0;
  state.addedAvailablePosition.clear();
  state.selectedOrder.length = 0;
  state.selectedPosition.clear();
  state.selectedSet.clear();
  state.availableCount = INITIAL_COUNT;
  state.customAvailableIndex = new SubstringIndex();
  state.selectedIndex = new SubstringIndex();
  resetAvailability();
}

export { rebuildSelectedPosition, rebuildAddedAvailablePosition };
