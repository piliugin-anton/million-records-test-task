import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { apiQueue } from "../api/apiQueue";
import type { Side } from "../types/items";

const PAGE_SIZE = 20;
/** Matches server MAX_LIMIT in server/index.ts */
const MAX_FETCH_SIZE = 100;

function pageOverlapsRange(page: number, startIndex: number, endIndex: number): boolean {
  if (endIndex < startIndex) return true;
  const pageStart = page * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE - 1;
  return pageEnd >= startIndex && pageStart <= endIndex;
}

function rangeOverlapsRequest(startIndex: number, endIndex: number, offset: number, limit: number): boolean {
  if (endIndex < startIndex || limit <= 0) return false;
  const requestEnd = offset + limit - 1;
  return requestEnd >= startIndex && offset <= endIndex;
}

type FetchChunk = { offset: number; limit: number; pages: number[] };

function buildFetchChunks(firstPage: number, lastPage: number): FetchChunk[] {
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

export function usePagedItems(side: Side, query: string) {
  const itemsRef = useRef<Record<number, string>>({});
  const [, setRenderKey] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const loadedPages = useRef(new Set<number>());
  const requestVersion = useRef(0);
  const pendingPages = useRef(new Set<number>());
  const requestedRangeRef = useRef({ start: 0, end: -1 });
  const totalRef = useRef(0);

  const bumpRender = useCallback(() => {
    setRenderKey((value) => value + 1);
  }, []);

  const syncLoading = useCallback(() => {
    setLoading(pendingPages.current.size > 0);
  }, []);

  const loadChunk = useCallback(
    async (chunk: FetchChunk, version = requestVersion.current) => {
      const pagesToLoad = chunk.pages.filter(
        (page) => !loadedPages.current.has(page) && !pendingPages.current.has(page)
      );
      if (pagesToLoad.length === 0) return;

      pagesToLoad.forEach((page) => pendingPages.current.add(page));
      syncLoading();

      const data = await apiQueue.fetchItems({
        side,
        query,
        offset: chunk.offset,
        limit: chunk.limit
      });

      if (requestVersion.current === version) {
        let wroteNewItem = false;
        data.items.forEach((id, index) => {
          const itemIndex = chunk.offset + index;
          if (itemsRef.current[itemIndex] !== id) {
            itemsRef.current[itemIndex] = id;
            wroteNewItem = true;
          }
        });

        pagesToLoad.forEach((page) => loadedPages.current.add(page));

        const { start, end } = requestedRangeRef.current;
        const shouldPaint =
          wroteNewItem && rangeOverlapsRequest(start, end, chunk.offset, chunk.limit);

        startTransition(() => {
          if (shouldPaint) {
            bumpRender();
          }
          if (data.total !== totalRef.current) {
            totalRef.current = data.total;
            setTotal(data.total);
          }
        });
      }

      pagesToLoad.forEach((page) => pendingPages.current.delete(page));
      syncLoading();
    },
    [bumpRender, query, side, syncLoading]
  );

  useEffect(() => {
    const unsubscribe = apiQueue.subscribe(() => setRefreshKey((value) => value + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    loadedPages.current.clear();
    pendingPages.current.clear();
    itemsRef.current = {};
    totalRef.current = 0;
    requestedRangeRef.current = { start: 0, end: -1 };
    setTotal(0);
    setRenderKey(0);
    void loadChunk({ offset: 0, limit: PAGE_SIZE, pages: [0] }, version);
  }, [loadChunk, refreshKey]);

  const loadRange = useCallback(
    (startIndex: number, endIndex: number) => {
      if (endIndex < startIndex) return;

      requestedRangeRef.current = { start: startIndex, end: endIndex };
      const firstPage = Math.floor(Math.max(0, startIndex) / PAGE_SIZE);
      const lastPage = Math.floor(Math.max(0, endIndex) / PAGE_SIZE);

      for (const chunk of buildFetchChunks(firstPage, lastPage)) {
        void loadChunk(chunk);
      }
    },
    [loadChunk]
  );

  const getItem = useCallback((index: number) => itemsRef.current[index], []);

  const optimisticRemove = useCallback(
    (id: string) => {
      loadedPages.current.clear();
      pendingPages.current.clear();
      itemsRef.current = {};
      requestedRangeRef.current = { start: 0, end: -1 };
      setTotal((value) => Math.max(0, value - 1));
      totalRef.current = Math.max(0, totalRef.current - 1);
      bumpRender();
    },
    [bumpRender]
  );

  const reorderLoadedItems = useCallback(
    (orderedIds: string[]) => {
      const movingIds = new Set(orderedIds);
      const next = { ...itemsRef.current };
      const replacementIndexes = Object.entries(next)
        .filter(([, itemId]) => movingIds.has(itemId))
        .map(([index]) => Number(index))
        .sort((left, right) => left - right);

      replacementIndexes.forEach((index, orderIndex) => {
        next[index] = orderedIds[orderIndex];
      });

      itemsRef.current = next;
      bumpRender();
    },
    [bumpRender]
  );

  return {
    getItem,
    loading,
    loadRange,
    optimisticRemove,
    refresh: () => setRefreshKey((value) => value + 1),
    reorderLoadedItems,
    total
  };
}
