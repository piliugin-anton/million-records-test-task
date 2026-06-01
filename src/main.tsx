import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, ArrowRight, GripVertical, Plus, RotateCw, Search } from "lucide-react";
import "./styles.css";

const PAGE_SIZE = 20;

type Side = "available" | "selected";

type ItemsResponse = {
  items: string[];
  total: number;
  offset: number;
  limit: number;
  side: Side;
  query: string;
  selectedCount: number;
};

type FetchParams = {
  side: Side;
  query: string;
  offset: number;
  limit: number;
};

type QueueListener = () => void;

class ApiQueue {
  private addIds = new Set<string>();
  private selectionOps = new Map<string, boolean>();
  private latestReorder: string[] | null = null;
  private fetches = new Map<string, { params: FetchParams; resolvers: Array<(value: ItemsResponse) => void> }>();
  private listeners = new Set<QueueListener>();

  constructor() {
    window.setInterval(() => void this.flushReadsAndChanges(), 1000);
    window.setInterval(() => void this.flushAdds(), 10000);
  }

  subscribe(listener: QueueListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  fetchItems(params: FetchParams) {
    const key = `${params.side}|${params.query}|${params.offset}|${params.limit}`;
    const queued = this.fetches.get(key);

    return new Promise<ItemsResponse>((resolve) => {
      if (queued) {
        queued.resolvers.push(resolve);
        return;
      }

      this.fetches.set(key, { params, resolvers: [resolve] });
    });
  }

  add(values: string[]) {
    values.map((value) => value.trim()).filter(Boolean).forEach((id) => this.addIds.add(id));
  }

  select(id: string) {
    this.selectionOps.set(id, true);
  }

  unselect(id: string) {
    this.selectionOps.set(id, false);
  }

  reorder(orderedVisibleIds: string[]) {
    this.latestReorder = [...new Set(orderedVisibleIds)];
  }

  private async flushReadsAndChanges() {
    const selectionOps = this.selectionOps;
    const reorder = this.latestReorder;
    const fetches = this.fetches;

    this.selectionOps = new Map();
    this.latestReorder = null;
    this.fetches = new Map();

    const writeRequests: Promise<unknown>[] = [];

    if (selectionOps.size > 0) {
      const select: string[] = [];
      const unselect: string[] = [];
      selectionOps.forEach((shouldSelect, id) => (shouldSelect ? select : unselect).push(id));
      writeRequests.push(
        fetch("/api/selection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ select, unselect })
        })
      );
    }

    if (reorder && reorder.length > 0) {
      writeRequests.push(
        fetch("/api/selection/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: reorder })
        })
      );
    }

    if (writeRequests.length > 0) {
      await Promise.allSettled(writeRequests);
      this.notify();
    }

    if (fetches.size === 0) return;

    await Promise.all(
      [...fetches.values()].map(async ({ params, resolvers }) => {
        const search = new URLSearchParams({
          side: params.side,
          query: params.query,
          offset: String(params.offset),
          limit: String(params.limit)
        });
        const response = await fetch(`/api/items?${search.toString()}`);
        const data = (await response.json()) as ItemsResponse;
        resolvers.forEach((resolve) => resolve(data));
      })
    );
  }

  private async flushAdds() {
    if (this.addIds.size === 0) return;

    const ids = [...this.addIds];
    this.addIds.clear();

    await fetch("/api/items/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    this.notify();
  }
}

const apiQueue = new ApiQueue();

function usePagedItems(side: Side, query: string) {
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

function useInfiniteScroll(onLoadMore: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !enabled) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onLoadMore();
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, onLoadMore]);

  return sentinelRef;
}

function parseIds(value: string) {
  return value.split(/[\s,;]+/).map((id) => id.trim()).filter(Boolean);
}

function Pane(props: {
  title: string;
  side: Side;
  query: string;
  onQueryChange: (value: string) => void;
  items: string[];
  total: number;
  loading: boolean;
  loadMore: () => void;
  onMove: (id: string) => void;
  onReorder?: (items: string[]) => void;
}) {
  const { title, side, query, onQueryChange, items, total, loading, loadMore, onMove, onReorder } = props;
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const sentinelRef = useInfiniteScroll(loadMore, items.length < total || items.length === 0);

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId || side !== "selected") return;

    const nextItems = [...items];
    const from = nextItems.indexOf(draggedId);
    const to = nextItems.indexOf(targetId);
    if (from < 0 || to < 0) return;

    nextItems.splice(from, 1);
    nextItems.splice(to, 0, draggedId);
    onReorder?.(nextItems);
    setDraggedId(null);
  };

  return (
    <section className="pane">
      <div className="paneHeader">
        <div>
          <h2>{title}</h2>
          <span>{items.length} / {total}</span>
        </div>
        <label className="searchBox">
          <Search size={18} />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Фильтр по ID" />
        </label>
      </div>

      <div className="list" aria-label={title}>
        {items.map((id) => (
          <div
            className={draggedId === id ? "row dragging" : "row"}
            draggable={side === "selected"}
            key={id}
            onDragStart={() => setDraggedId(id)}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => side === "selected" && event.preventDefault()}
            onDrop={() => handleDrop(id)}
          >
            <div className="rowMain">
              {side === "selected" ? <GripVertical className="grip" size={18} /> : <span className="dot" />}
              <span className="idText">ID {id}</span>
            </div>
            <button className="iconButton" onClick={() => onMove(id)} title={side === "selected" ? "Убрать" : "Выбрать"}>
              {side === "selected" ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
            </button>
          </div>
        ))}

        <div ref={sentinelRef} className="sentinel">
          {loading ? "Загрузка..." : items.length >= total ? "Конец списка" : ""}
        </div>
      </div>
    </section>
  );
}

function App() {
  const [availableQuery, setAvailableQuery] = useState("");
  const [selectedQuery, setSelectedQuery] = useState("");
  const [newId, setNewId] = useState("");
  const available = usePagedItems("available", availableQuery);
  const selected = usePagedItems("selected", selectedQuery);

  const addPreview = useMemo(() => parseIds(newId), [newId]);

  const handleAdd = () => {
    if (addPreview.length === 0) return;
    apiQueue.add(addPreview);
    setNewId("");
  };

  const handleSelect = (id: string) => {
    apiQueue.select(id);
    available.setItems((items) => items.filter((item) => item !== id));
  };

  const handleUnselect = (id: string) => {
    apiQueue.unselect(id);
    selected.setItems((items) => items.filter((item) => item !== id));
  };

  const handleReorder = (nextItems: string[]) => {
    selected.setItems(nextItems);
    apiQueue.reorder(nextItems);
  };

  return (
    <main className="appShell">
      <header className="topBar">
        <div>
          <h1>Million Records</h1>
          <p>Выбор, фильтрация и порядок элементов хранятся на Express-сервере в памяти.</p>
        </div>
        <div className="addBox">
          <input
            value={newId}
            onChange={(event) => setNewId(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleAdd()}
            placeholder="Новый ID"
          />
          <button onClick={handleAdd} disabled={addPreview.length === 0}>
            <Plus size={18} />
            Добавить
          </button>
          <button className="iconButton" onClick={() => { available.refresh(); selected.refresh(); }} title="Обновить списки">
            <RotateCw size={18} />
          </button>
        </div>
      </header>

      <div className="workspace">
        <Pane
          title="Все элементы"
          side="available"
          query={availableQuery}
          onQueryChange={setAvailableQuery}
          items={available.items}
          total={available.total}
          loading={available.loading}
          loadMore={available.loadMore}
          onMove={handleSelect}
        />
        <Pane
          title="Выбранные"
          side="selected"
          query={selectedQuery}
          onQueryChange={setSelectedQuery}
          items={selected.items}
          total={selected.total}
          loading={selected.loading}
          loadMore={selected.loadMore}
          onMove={handleUnselect}
          onReorder={handleReorder}
        />
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
