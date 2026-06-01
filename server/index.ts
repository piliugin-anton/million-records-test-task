import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INITIAL_COUNT = 1_000_000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type Side = "available" | "selected";

const app = express();
app.use(express.json({ limit: "1mb" }));

const addedIds = new Set<string>();
const selectedOrder: string[] = [];
const selectedSet = new Set<string>();

function normalizeId(value: unknown): string | null {
  const id = String(value ?? "").trim();
  return id.length > 0 ? id : null;
}

function isInitialId(id: string): boolean {
  if (!/^\d+$/.test(id)) return false;
  const numberId = Number(id);
  return Number.isSafeInteger(numberId) && numberId >= 1 && numberId <= INITIAL_COUNT && String(numberId) === id;
}

function itemExists(id: string): boolean {
  return isInitialId(id) || addedIds.has(id);
}

function matchesQuery(id: string, query: string): boolean {
  return query === "" || id.includes(query);
}

function parseListQuery(req: express.Request) {
  const side = req.query.side === "selected" ? "selected" : "available";
  const query = String(req.query.query ?? "").trim();
  const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));
  return { side: side as Side, query, offset, limit };
}

function getSelectedPage(query: string, offset: number, limit: number) {
  const items: string[] = [];
  let skipped = 0;
  let total = 0;

  for (const id of selectedOrder) {
    if (!matchesQuery(id, query)) continue;
    total += 1;
    if (skipped < offset) {
      skipped += 1;
      continue;
    }
    if (items.length < limit) items.push(id);
  }

  return { items, total };
}

function visitAvailableIds(query: string, visitor: (id: string) => boolean | void) {
  for (let numberId = 1; numberId <= INITIAL_COUNT; numberId += 1) {
    const id = String(numberId);
    if (selectedSet.has(id) || !matchesQuery(id, query)) continue;
    if (visitor(id) === false) return;
  }

  for (const id of addedIds) {
    if (selectedSet.has(id) || isInitialId(id) || !matchesQuery(id, query)) continue;
    if (visitor(id) === false) return;
  }
}

function getAvailablePage(query: string, offset: number, limit: number) {
  const items: string[] = [];
  let skipped = 0;
  let total = 0;

  visitAvailableIds(query, (id) => {
    total += 1;
    if (skipped < offset) {
      skipped += 1;
      return;
    }
    if (items.length < limit) items.push(id);
  });

  return { items, total };
}

app.get("/api/items", (req, res) => {
  const { side, query, offset, limit } = parseListQuery(req);
  const result = side === "selected" ? getSelectedPage(query, offset, limit) : getAvailablePage(query, offset, limit);

  res.json({
    ...result,
    offset,
    limit,
    side,
    query,
    selectedCount: selectedOrder.length
  });
});

app.post("/api/items/add", (req, res) => {
  const incoming = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const seenInRequest = new Set<string>();
  const added: string[] = [];
  const skipped: string[] = [];

  for (const value of incoming) {
    const id = normalizeId(value);
    if (!id || seenInRequest.has(id) || itemExists(id)) {
      if (id) skipped.push(id);
      continue;
    }

    seenInRequest.add(id);
    addedIds.add(id);
    added.push(id);
  }

  res.json({ added, skipped });
});

app.post("/api/selection", (req, res) => {
  const select = Array.isArray(req.body?.select) ? req.body.select : [];
  const unselect = Array.isArray(req.body?.unselect) ? req.body.unselect : [];

  for (const value of unselect) {
    const id = normalizeId(value);
    if (!id || !selectedSet.has(id)) continue;
    selectedSet.delete(id);
    const index = selectedOrder.indexOf(id);
    if (index >= 0) selectedOrder.splice(index, 1);
  }

  for (const value of select) {
    const id = normalizeId(value);
    if (!id || !itemExists(id) || selectedSet.has(id)) continue;
    selectedSet.add(id);
    selectedOrder.push(id);
  }

  res.json({ selectedCount: selectedOrder.length });
});

app.post("/api/selection/reorder", (req, res) => {
  const orderedIds: string[] = Array.isArray(req.body?.orderedIds)
    ? req.body.orderedIds.map((value: unknown) => normalizeId(value)).filter((id: string | null): id is string => Boolean(id))
    : [];

  const uniqueOrderedIds = [...new Set(orderedIds)].filter((id) => selectedSet.has(id));
  const replacementPositions: number[] = [];
  const movingIds = new Set(uniqueOrderedIds);

  selectedOrder.forEach((id, index) => {
    if (movingIds.has(id)) replacementPositions.push(index);
  });

  replacementPositions.forEach((position, index) => {
    selectedOrder[position] = uniqueOrderedIds[index];
  });

  res.json({ selectedCount: selectedOrder.length });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, "../client");

app.use(express.static(clientDir));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
