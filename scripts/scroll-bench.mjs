/**
 * Measures scroll performance on the left ("Все элементы") pane.
 * Usage: node scripts/scroll-bench.mjs [baseUrl]
 */
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://localhost:5173";

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return {
    count: sorted.length,
    mean: sorted.length ? sum / sorted.length : 0,
    p50: p(0.5),
    p95: p(0.95),
    max: sorted.at(-1) ?? 0,
    jankyFrames: sorted.filter((ms) => ms > 16.67).length,
    severeFrames: sorted.filter((ms) => ms > 50).length
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  await page.waitForSelector('[aria-label="Все элементы"]');
  await page.waitForFunction(() => {
    const scroller = document.querySelector('[aria-label="Все элементы"]');
    return scroller && scroller.scrollHeight > 1000;
  }, { timeout: 30_000 });

  const layoutCheck = await page.evaluate(() => {
    const scroller = document.querySelector('[aria-label="Все элементы"]');
    const rows = scroller?.querySelectorAll("[style*='top']") ?? [];
    const tops = [...rows].map((row) => parseFloat(row.style.top || "0")).filter((v) => !Number.isNaN(v));
    const uniqueTops = new Set(tops);
    return { rowCount: rows.length, uniqueTopCount: uniqueTops.size, sampleTops: tops.slice(0, 5) };
  });

  const metrics = await page.evaluate(async () => {
    const scroller = document.querySelector('[aria-label="Все элементы"]');
    if (!scroller) throw new Error("scroller not found");

    const frameDeltas = [];
    let lastFrame = performance.now();
    let measuring = true;

    const trackFrames = () => {
      if (!measuring) return;
      const now = performance.now();
      frameDeltas.push(now - lastFrame);
      lastFrame = now;
      requestAnimationFrame(trackFrames);
    };
    requestAnimationFrame(trackFrames);

    const scrollDurationMs = 2500;
    const scrollStart = performance.now();
    const maxScroll = Math.min(scroller.scrollHeight - scroller.clientHeight, 120_000);

    await new Promise((resolve) => {
      const tick = () => {
        const t = (performance.now() - scrollStart) / scrollDurationMs;
        if (t >= 1) {
          scroller.scrollTop = maxScroll;
          resolve();
          return;
        }
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        scroller.scrollTop = Math.floor(maxScroll * eased);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    measuring = false;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const longTasks = performance.getEntriesByType("longtask").map((e) => e.duration);
    return {
      frameDeltas,
      longTasks,
      finalScrollTop: scroller.scrollTop,
      maxScroll
    };
  });

  await browser.close();

  const frames = summarize(metrics.frameDeltas);

  console.log(JSON.stringify({ baseUrl, layoutCheck, frames }, null, 2));
  console.log(
    `\nScroll bench: p95 frame ${frames.p95.toFixed(1)}ms, janky ${frames.jankyFrames}/${frames.count}, rows=${layoutCheck.rowCount}, uniqueTops=${layoutCheck.uniqueTopCount}`
  );

  if (layoutCheck.uniqueTopCount < 3 && layoutCheck.rowCount > 3) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
