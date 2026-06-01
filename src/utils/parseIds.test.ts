import { describe, expect, it } from "vitest";
import { parseIds } from "./parseIds.js";

describe("parseIds", () => {
  it("splits on spaces, commas, and semicolons", () => {
    expect(parseIds("1, 2;3  4")).toEqual(["1", "2", "3", "4"]);
  });

  it("drops empty segments", () => {
    expect(parseIds("1,, ; 2")).toEqual(["1", "2"]);
  });
});
