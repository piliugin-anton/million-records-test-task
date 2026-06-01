import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp } from "./app.js";

describe("API routes", () => {
  const { app, reset } = createTestApp();

  afterEach(() => {
    reset();
  });

  it("lists available items without a query", async () => {
    const response = await request(app).get("/api/items?side=available&offset=0&limit=3");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual(["1", "2", "3"]);
    expect(response.body.total).toBe(1_000_000);
  });

  it("filters available items by query", async () => {
    const response = await request(app).get("/api/items?side=available&query=999999&offset=0&limit=5");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual(["999999"]);
    expect(response.body.total).toBe(1);
  });

  it("adds custom ids and skips duplicates", async () => {
    const first = await request(app).post("/api/items/add").send({ ids: ["custom-1", "custom-1", "5"] });
    expect(first.body).toEqual({ added: ["custom-1"], skipped: ["custom-1", "5"] });

    const list = await request(app).get("/api/items?side=available&query=custom&offset=0&limit=10");
    expect(list.body.items).toEqual(["custom-1"]);
    expect(list.body.total).toBe(1);
  });

  it("selects and unselects ids", async () => {
    await request(app).post("/api/items/add").send({ ids: ["custom-1"] });
    await request(app).post("/api/selection").send({ select: ["42", "custom-1"] });

    const selected = await request(app).get("/api/items?side=selected&offset=0&limit=10");
    expect(selected.body.items).toEqual(["42", "custom-1"]);
    expect(selected.body.total).toBe(2);

    await request(app).post("/api/selection").send({ unselect: ["42"] });

    const available = await request(app).get("/api/items?side=available&query=42&offset=0&limit=5");
    expect(available.body.items[0]).toBe("42");
    expect(available.body.total).toBeGreaterThan(0);
  });

  it("reorders visible selected ids", async () => {
    await request(app).post("/api/selection").send({ select: ["1", "2", "3", "4"] });
    await request(app).post("/api/selection/reorder").send({ orderedIds: ["4", "2"] });

    const selected = await request(app).get("/api/items?side=selected&offset=0&limit=10");
    expect(selected.body.items).toEqual(["1", "4", "3", "2"]);
  });
});
