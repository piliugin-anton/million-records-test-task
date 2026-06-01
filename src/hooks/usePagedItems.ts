import { useCallback, useEffect, useRef, useState } from "react";
import { apiQueue } from "../api/apiQueue";
import type { Side } from "../types/items";

const PAGE_SIZE = 20;

export function usePagedItems(side: Side, query: string) {
  const [items, setItems] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestVersion = useRef(0);

  useEffect(() => {
    const unsubscribe = apiQueue.subscribe(() => setRefreshKey((value) => value + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setItems([]);
    setTotal(0);
    setLoading(true);

    void apiQueue.fetchItems({ side, query, offset: 0, limit: PAGE_SIZE }).then((data) => {
      if (requestVersion.current !== version) return;
      setItems(data.items);
      setTotal(data.total);
      setLoading(false);
    });
  }, [query, side, refreshKey]);

  const loadMore = useCallback(async () => {
    if (loading) return;
    if (items.length > 0 && items.length >= total) return;
    if (items.length === 0) return;

    const version = requestVersion.current;
    const offset = items.length;
    setLoading(true);
    const data = await apiQueue.fetchItems({ side, query, offset, limit: PAGE_SIZE });
    if (requestVersion.current === version) {
      setItems((current) => (offset === 0 ? data.items : [...current, ...data.items]));
      setTotal(data.total);
    }
    setLoading(false);
  }, [items.length, loading, query, side, total]);

  return { items, setItems, total, loading, loadMore, refresh: () => setRefreshKey((value) => value + 1) };
}
