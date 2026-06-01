import type { FetchParams, ItemsResponse } from "../types/items";

const api = (path: string) => `${import.meta.env.BASE_URL}api${path}`;

export type SyncReason = "add" | "selectionFailed";

const READ_FLUSH_MS = 1_000;
/** Adds are batched separately from reads/changes; selection may lag until the next add flush. */
const ADD_FLUSH_MS = 10_000;

type QueueListener = (reason: SyncReason) => void;

export class ApiQueue {
  private addIds = new Set<string>();
  private selectionOps = new Map<string, boolean>();
  private latestReorder: string[] | null = null;
  private fetches = new Map<string, { params: FetchParams; resolvers: Array<(value: ItemsResponse) => void> }>();
  private listeners = new Set<QueueListener>();
  private addFlushInFlight = false;

  constructor() {
    globalThis.setInterval(() => void this.flushReadsAndChanges(), READ_FLUSH_MS);
    globalThis.setInterval(() => void this.flushAdds(), ADD_FLUSH_MS);
  }

  subscribe(listener: QueueListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(reason: SyncReason) {
    this.listeners.forEach((listener) => listener(reason));
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
    let selectionRequestIndex = -1;

    if (selectionOps.size > 0) {
      const select: string[] = [];
      const unselect: string[] = [];
      selectionOps.forEach((shouldSelect, id) => (shouldSelect ? select : unselect).push(id));
      selectionRequestIndex = writeRequests.length;
      writeRequests.push(
        fetch(api("/selection"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ select, unselect })
        })
      );
    }

    if (reorder && reorder.length > 0) {
      writeRequests.push(
        fetch(api("/selection/reorder"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: reorder })
        })
      );
    }

    if (writeRequests.length > 0) {
      const results = await Promise.allSettled(writeRequests);
      if (selectionRequestIndex >= 0 && results[selectionRequestIndex]?.status === "rejected") {
        this.notify("selectionFailed");
      }
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
        const response = await fetch(`${api("/items")}?${search.toString()}`);
        const data = (await response.json()) as ItemsResponse;
        resolvers.forEach((resolve) => resolve(data));
      })
    );
  }

  private async flushAdds() {
    if (this.addIds.size === 0 || this.addFlushInFlight) return;

    this.addFlushInFlight = true;
    const ids = [...this.addIds];
    this.addIds.clear();

    try {
      await fetch(api("/items/add"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      this.notify("add");
    } finally {
      this.addFlushInFlight = false;
    }
  }
}

export const apiQueue = new ApiQueue();
