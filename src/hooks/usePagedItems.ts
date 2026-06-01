import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { matchesQuery } from "../../shared/matchesQuery";
import { apiQueue } from "../api/apiQueue";
import type { Side } from "../types/items";
import {
  buildFetchChunks,
  indexOverlapsRange,
  invalidatePagesFrom,
  keepItemsBeforePage,
  PAGE_SIZE,
  pageOverlapsRange,
  rangeOverlapsRequest,
  removeIdFromCache,
  type FetchChunk
} from "./pagingHelpers";

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
  const loadRangeRef = useRef<(startIndex: number, endIndex: number) => void>(() => {});

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

  const invalidateAndReloadVisible = useCallback(() => {
    requestVersion.current += 1;
    loadedPages.current.clear();
    pendingPages.current.clear();
    itemsRef.current = {};
    syncLoading();

    const { start, end } = requestedRangeRef.current;
    if (end >= start) {
      loadRangeRef.current(start, end);
    }
  }, [syncLoading]);

  const reconcileVisibleAfterAdd = useCallback(() => {
    if (side !== "available") return;

    const { start, end } = requestedRangeRef.current;
    if (end >= start) {
      loadRangeRef.current(start, end);
    }
  }, [side]);

  useEffect(() => {
    const unsubscribe = apiQueue.subscribe((reason) => {
      if (reason === "selectionFailed") {
        invalidateAndReloadVisible();
      } else if (reason === "add") {
        reconcileVisibleAfterAdd();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [invalidateAndReloadVisible, reconcileVisibleAfterAdd]);

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

  loadRangeRef.current = loadRange;

  const getItem = useCallback((index: number) => itemsRef.current[index], []);

  const optimisticRemove = useCallback(
    (id: string) => {
      const { next, removedIndex } = removeIdFromCache(itemsRef.current, id);

      if (removedIndex !== null) {
        if (side === "available") {
          const fromPage = Math.floor(removedIndex / PAGE_SIZE);
          itemsRef.current = keepItemsBeforePage(next, fromPage);
          invalidatePagesFrom(fromPage, loadedPages.current);
        } else {
          itemsRef.current = next;
          const lastIndex = Object.keys(next).reduce(
            (max, key) => Math.max(max, Number(key)),
            -1
          );
          if (lastIndex >= 0) {
            loadedPages.current.delete(Math.floor(lastIndex / PAGE_SIZE));
          }
        }
      }

      totalRef.current = Math.max(0, totalRef.current - 1);
      setTotal(totalRef.current);

      const { start, end } = requestedRangeRef.current;
      let shouldPaint = false;
      if (removedIndex !== null) {
        if (side === "selected") {
          shouldPaint = indexOverlapsRange(removedIndex, start, end);
        } else {
          const fromPage = Math.floor(removedIndex / PAGE_SIZE);
          shouldPaint =
            indexOverlapsRange(removedIndex, start, end) ||
            pageOverlapsRange(fromPage, start, end);
        }
      }
      if (shouldPaint) {
        bumpRender();
      }

      if (side === "available" && removedIndex !== null) {
        const fromPage = Math.floor(removedIndex / PAGE_SIZE);
        if (pageOverlapsRange(fromPage, start, end)) {
          loadRangeRef.current(Math.max(start, fromPage * PAGE_SIZE), end);
        }
      }
    },
    [bumpRender, side]
  );

  const optimisticReturn = useCallback(
    (id: string) => {
      if (side !== "available" || !matchesQuery(id, query)) return;

      totalRef.current += 1;
      setTotal(totalRef.current);
      itemsRef.current = {};
      loadedPages.current.clear();
      pendingPages.current.clear();
      bumpRender();

      const { start, end } = requestedRangeRef.current;
      if (end >= start) {
        loadRangeRef.current(start, end);
      }
    },
    [bumpRender, query, side]
  );

  const optimisticAppend = useCallback(
    (id: string) => {
      if (side !== "selected" || !matchesQuery(id, query)) return;

      const index = totalRef.current;
      itemsRef.current[index] = id;
      loadedPages.current.add(Math.floor(index / PAGE_SIZE));
      totalRef.current += 1;
      setTotal(totalRef.current);
      bumpRender();
    },
    [bumpRender, query, side]
  );

  const optimisticAdd = useCallback(
    (ids: string[]) => {
      if (side !== "available") return;

      const { start, end } = requestedRangeRef.current;
      let shouldPaint = false;

      let added = 0;

      for (const id of ids) {
        if (!matchesQuery(id, query)) continue;

        const index = totalRef.current;
        itemsRef.current[index] = id;
        loadedPages.current.add(Math.floor(index / PAGE_SIZE));
        totalRef.current += 1;
        added += 1;

        if (indexOverlapsRange(index, start, end)) {
          shouldPaint = true;
        }
      }

      if (added > 0) {
        setTotal(totalRef.current);
      }
      if (shouldPaint) {
        bumpRender();
      }
    },
    [bumpRender, query, side]
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
    optimisticAdd,
    optimisticAppend,
    optimisticRemove,
    optimisticReturn,
    refresh: () => setRefreshKey((value) => value + 1),
    reorderLoadedItems,
    total
  };
}
