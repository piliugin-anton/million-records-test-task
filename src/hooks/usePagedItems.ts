import { useCallback, useEffect, useRef, useState } from "react";
import { apiQueue } from "../api/apiQueue";
import type { Side } from "../types/items";

const PAGE_SIZE = 20;

export function usePagedItems(side: Side, query: string) {
  const [itemsByIndex, setItemsByIndex] = useState<Record<number, string>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const loadedPages = useRef(new Set<number>());
  const requestVersion = useRef(0);
  const pendingPages = useRef(new Set<number>());

  const loadPage = useCallback(async (page: number, version = requestVersion.current) => {
    if (page < 0 || loadedPages.current.has(page) || pendingPages.current.has(page)) return;
    pendingPages.current.add(page);
    setLoading(true);

    const offset = page * PAGE_SIZE;
    const data = await apiQueue.fetchItems({ side, query, offset, limit: PAGE_SIZE });

    if (requestVersion.current === version) {
      setItemsByIndex((current) => {
        const next = { ...current };
        data.items.forEach((id, index) => {
          next[offset + index] = id;
        });
        return next;
      });
      setTotal(data.total);
      loadedPages.current.add(page);
    }

    pendingPages.current.delete(page);
    setLoading(false);
  }, [query, side]);

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
    setItemsByIndex({});
    setTotal(0);
    void loadPage(0, version);
  }, [loadPage, refreshKey]);

  const loadRange = useCallback((startIndex: number, endIndex: number) => {
    if (endIndex < startIndex) return;

    const firstPage = Math.floor(Math.max(0, startIndex) / PAGE_SIZE);
    const lastPage = Math.floor(Math.max(0, endIndex) / PAGE_SIZE);

    for (let page = firstPage; page <= lastPage; page += 1) {
      void loadPage(page);
    }
  }, [loadPage]);

  const getItem = useCallback((index: number) => itemsByIndex[index], [itemsByIndex]);

  const optimisticRemove = useCallback((id: string) => {
    loadedPages.current.clear();
    pendingPages.current.clear();
    setItemsByIndex({});
    setTotal((value) => Math.max(0, value - 1));
  }, []);

  const reorderLoadedItems = useCallback((orderedIds: string[]) => {
    const movingIds = new Set(orderedIds);

    setItemsByIndex((current) => {
      const next = { ...current };
      const replacementIndexes = Object.entries(next)
        .filter(([, id]) => movingIds.has(id))
        .map(([index]) => Number(index))
        .sort((left, right) => left - right);

      replacementIndexes.forEach((index, orderIndex) => {
        next[index] = orderedIds[orderIndex];
      });

      return next;
    });
  }, []);

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
