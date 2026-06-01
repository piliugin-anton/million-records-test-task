import { INITIAL_COUNT } from "./availability.js";
import { InitialNumericSubstringIndex } from "./substringIndex.js";

let index: InitialNumericSubstringIndex | null = null;

function getIndex(): InitialNumericSubstringIndex {
  if (!index) {
    index = new InitialNumericSubstringIndex();
    index.build(INITIAL_COUNT);
  }
  return index;
}

export function getInitialIdsMatching(query: string): readonly number[] {
  return getIndex().getMatchingNumbers(query);
}

export function buildInitialIndex(count = INITIAL_COUNT): InitialNumericSubstringIndex {
  index = new InitialNumericSubstringIndex();
  index.build(count);
  return index;
}

export { InitialNumericSubstringIndex };
