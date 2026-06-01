import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeId } from "./listQuery.js";
import { DEFAULT_LIMIT, MAX_LIMIT, parseListQuery } from "./listQuery.js";
import { getAvailablePage, getSelectedPage } from "./pagination.js";
import {
  addItems,
  applyReorder,
  applySelection,
  createAppState,
  resetAppState,
  type AppState
} from "./state.js";

export { DEFAULT_LIMIT, MAX_LIMIT, normalizeId, parseListQuery, createAppState, resetAppState };
export type { AppState };

export function createApp(initialState?: AppState) {
  const state = initialState ?? createAppState();
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/items", (req, res) => {
    const { side, query, offset, limit } = parseListQuery(req);
    const result = side === "selected" ? getSelectedPage(state, query, offset, limit) : getAvailablePage(state, query, offset, limit);

    res.json({
      ...result,
      offset,
      limit,
      side,
      query,
      selectedCount: state.selectedOrder.length
    });
  });

  app.post("/api/items/add", (req, res) => {
    const incoming = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const normalized = incoming
      .map((value: unknown) => normalizeId(value))
      .filter((id: string | null): id is string => Boolean(id));
    res.json(addItems(state, normalized));
  });

  app.post("/api/selection", (req, res) => {
    const select = Array.isArray(req.body?.select) ? req.body.select : [];
    const unselect = Array.isArray(req.body?.unselect) ? req.body.unselect : [];
    const normalizedSelect = select
      .map((value: unknown) => normalizeId(value))
      .filter((id: string | null): id is string => Boolean(id));
    const normalizedUnselect = unselect
      .map((value: unknown) => normalizeId(value))
      .filter((id: string | null): id is string => Boolean(id));
    res.json({ selectedCount: applySelection(state, normalizedSelect, normalizedUnselect) });
  });

  app.post("/api/selection/reorder", (req, res) => {
    const orderedIds: string[] = Array.isArray(req.body?.orderedIds)
      ? req.body.orderedIds
          .map((value: unknown) => normalizeId(value))
          .filter((id: string | null): id is string => Boolean(id))
      : [];
    res.json({ selectedCount: applyReorder(state, orderedIds) });
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDir = path.resolve(__dirname, "../client");

  app.use(express.static(clientDir));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });

  return { app, state };
}

export function createTestApp() {
  const state = createAppState();
  const { app } = createApp(state);
  return { app, state, reset: () => resetAppState(state) };
}
