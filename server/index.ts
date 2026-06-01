import { createApp } from "./app.js";

export { createApp, createTestApp, createAppState, resetAppState } from "./app.js";
export type { AppState } from "./app.js";
export { getAvailablePage, getSelectedPage } from "./pagination.js";
export { applySelection, addItems, applyReorder } from "./state.js";
export { SubstringIndex, InitialNumericSubstringIndex } from "./substringIndex.js";
export { getInitialIdsMatching } from "./initialSubstringIndex.js";
export { matchesQuery } from "../shared/matchesQuery.js";
export { normalizeId, isInitialId, parseListQuery } from "./listQuery.js";

if (!process.env.VITEST) {
  const { app } = createApp();
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}
