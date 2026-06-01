import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FetchCall = { url: string; init?: RequestInit };

function isAddRequest(call: FetchCall): boolean {
  return call.url.includes("/api/items/add");
}

function isSelectionRequest(call: FetchCall): boolean {
  return call.url.includes("/api/selection");
}

describe("ApiQueue batching", () => {
  let fetchCalls: FetchCall[] = [];
  let ApiQueue: typeof import("./apiQueue").ApiQueue;

  beforeEach(async () => {
    vi.useFakeTimers();
    fetchCalls = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        fetchCalls.push({ url, init });
        return Promise.resolve({
          json: () => Promise.resolve({ items: [], total: 0 })
        });
      })
    );

    vi.resetModules();
    ({ ApiQueue } = await import("./apiQueue"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("does not flush adds before 10 seconds", async () => {
    const queue = new ApiQueue();
    queue.add(["a"]);

    await vi.advanceTimersByTimeAsync(9_999);
    expect(fetchCalls.filter(isAddRequest)).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchCalls.filter(isAddRequest)).toHaveLength(1);
    expect(fetchCalls.find(isAddRequest)?.init?.body).toBe(JSON.stringify({ ids: ["a"] }));
  });

  it("flushes selection on 1s without flushing adds in between", async () => {
    const queue = new ApiQueue();
    queue.add(["pending-id"]);
    queue.select("42");

    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetchCalls.filter(isAddRequest)).toHaveLength(0);
    expect(fetchCalls.filter(isSelectionRequest)).toHaveLength(1);

    const selectionBody = JSON.parse(
      (fetchCalls.find(isSelectionRequest)?.init?.body as string) ?? "{}"
    );
    expect(selectionBody.select).toEqual(["42"]);
  });
});
