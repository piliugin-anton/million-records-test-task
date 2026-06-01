import type express from "express";
import { INITIAL_COUNT } from "./availability.js";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export type Side = "available" | "selected";

export function normalizeId(value: unknown): string | null {
  const id = String(value ?? "").trim();
  return id.length > 0 ? id : null;
}

export function isInitialId(id: string): boolean {
  if (!/^\d+$/.test(id)) return false;
  const numberId = Number(id);
  return Number.isSafeInteger(numberId) && numberId >= 1 && numberId <= INITIAL_COUNT && String(numberId) === id;
}

export function parseListQuery(req: express.Request) {
  const side = req.query.side === "selected" ? "selected" : "available";
  const query = String(req.query.query ?? "").trim();
  const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));
  return { side: side as Side, query, offset, limit };
}
