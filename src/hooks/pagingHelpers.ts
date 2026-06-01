export const PAGE_SIZE = 20;
export const MAX_FETCH_SIZE = 100;

export function pageOverlapsRange(page: number, startIndex: number, endIndex: number): boolean {
  if (endIndex < startIndex) return true;
  const pageStart = page * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE - 1;
  return pageEnd >= startIndex && pageStart <= endIndex;
}

export function rangeOverlapsRequest(startIndex: number, endIndex: number, offset: number, limit: number): boolean {
  if (endIndex < startIndex || limit <= 0) return false;
  const requestEnd = offset + limit - 1;
  return requestEnd >= startIndex && offset <= endIndex;
}

export function indexOverlapsRange(index: number, startIndex: number, endIndex: number): boolean {
  return endIndex >= startIndex && index >= startIndex && index <= endIndex;
}

export type FetchChunk = { offset: number; limit: number; pages: number[] };

export function buildFetchChunks(firstPage: number, lastPage: number): FetchChunk[] {
  const pagesPerChunk = Math.floor(MAX_FETCH_SIZE / PAGE_SIZE);
  const chunks: FetchChunk[] = [];

  for (let page = firstPage; page <= lastPage; ) {
    const chunkEndPage = Math.min(lastPage, page + pagesPerChunk - 1);
    const pageCount = chunkEndPage - page + 1;
    chunks.push({
      offset: page * PAGE_SIZE,
      limit: pageCount * PAGE_SIZE,
      pages: Array.from({ length: pageCount }, (_value, index) => page + index)
    });
    page = chunkEndPage + 1;
  }

  return chunks;
}

export function removeIdFromCache(
  cache: Record<number, string>,
  id: string
): { next: Record<number, string>; removedIndex: number | null } {
  const entries = Object.entries(cache)
    .map(([index, itemId]) => [Number(index), itemId] as const)
    .sort(([left], [right]) => left - right);
  const removedAt = entries.findIndex(([, itemId]) => itemId === id);
  if (removedAt < 0) return { next: cache, removedIndex: null };

  const removedIndex = entries[removedAt][0];
  const next: Record<number, string> = {};

  for (const [index, itemId] of entries) {
    if (itemId === id) continue;
    next[index > removedIndex ? index - 1 : index] = itemId;
  }

  return { next, removedIndex };
}

export function invalidatePagesFrom(page: number, loadedPages: Set<number>) {
  for (const loadedPage of loadedPages) {
    if (loadedPage >= page) loadedPages.delete(loadedPage);
  }
}

export function keepItemsBeforePage(cache: Record<number, string>, beforePage: number): Record<number, string> {
  const kept: Record<number, string> = {};
  for (const [index, itemId] of Object.entries(cache)) {
    const numericIndex = Number(index);
    if (Math.floor(numericIndex / PAGE_SIZE) < beforePage) {
      kept[numericIndex] = itemId;
    }
  }
  return kept;
}
