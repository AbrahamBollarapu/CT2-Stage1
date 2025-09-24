import { test, expect } from "@playwright/test";

test("Go Live starts and ingest is observable without dev hooks", async ({ page }) => {
  // ---- 1) Autodiscover a reachable origin+path
  const bases = Array.from(new Set([
    process.env.BASE_URL || "http://localhost:8081",
    "http://localhost:8081",
    "http://localhost:8085",
  ]));
  const paths = ["", "/", "/dashboard", "/index.html"];
  let landed = false;
  for (const b of bases) {
    for (const p of paths) {
      const u = (b.replace(/\/$/, "") + "/" + p.replace(/^\//, "")).replace(/\/+$/, "/");
      try {
        await page.goto(u, { waitUntil: "domcontentloaded" });
        if (await page.locator("button").first().isVisible().catch(() => false)) { landed = true; break; }
      } catch { /* try next */ }
    }
    if (landed) break;
  }
  expect(landed, "App not reachable on 8081/8085").toBeTruthy();

  // ---- 2) Open the Go Live modal via multiple strategies
  // Try obvious buttons first (role/name), then rocket emoji, then the public event.
  const goLiveByRole = page.getByRole("button", { name: /go live/i }).first();
  const goLiveByEmoji = page.locator('button:has-text("🚀")').first();

  let opened = false;
  if (await goLiveByRole.isVisible().catch(() => false)) {
    await goLiveByRole.click();
    opened = true;
  } else if (await goLiveByEmoji.isVisible().catch(() => false)) {
    await goLiveByEmoji.click();
    opened = true;
  }
  if (!opened) {
    // Fire the public event used by the app (works with older GoLive too)
    await page.evaluate(() => window.dispatchEvent(new Event("golive:open")));
  }

  // Wait for a modal-ish UI: header containing "Go Live" OR a Start/Stop button OR a footer with POST /api/...
  const modalHeader = page.locator("text=Go Live").first();
  const startBtnRole = page.getByRole("button", { name: /start/i }).first();
  const stopBtnRole  = page.getByRole("button", { name: /stop/i }).first();
  const footerCode   = page.locator("code:has-text('/api/')").first();

  const modalAppeared =
    (await modalHeader.isVisible().catch(() => false)) ||
    (await startBtnRole.isVisible().catch(() => false)) ||
    (await stopBtnRole.isVisible().catch(() => false))  ||
    (await footerCode.isVisible().catch(() => false));

  if (!modalAppeared) {
    // Try the event again in case GoLive mounted after first tick
    await page.evaluate(() => window.dispatchEvent(new Event("golive:open")));
  }

  // ---- 3) Start ingest if Start is visible; otherwise assume already running
  if (await startBtnRole.isVisible().catch(() => false)) {
    await startBtnRole.click();
  } else {
    // As a generic fallback, press Enter (often triggers primary button in dialogs)
    await page.keyboard.press("Enter").catch(() => {});
  }

  // ---- 4) Evidence that ingest is running (accept any of the below):
  // A) Stop button remains visible (loop running)
  // B) Network shows at least one 2xx POST to /api/edge/ingest or /api/time-series/points
  // C) Footer endpoint resolves from placeholder to a concrete path
  let proof = false;

  // A) Stop present for a short window
  if (await stopBtnRole.isVisible({ timeout: 8000 }).catch(() => false)) {
    // keep it stable briefly
    await page.waitForTimeout(1200);
    if (await stopBtnRole.isVisible().catch(() => false)) proof = true;
  }

  // B) Look for a success POST if we still need proof
  if (!proof) {
    const okResp = await page.waitForResponse(
      (r) => /\/api\/(edge\/ingest|time-series\/points)/.test(r.url()) && r.request().method() === "POST" && r.status() >= 200 && r.status() < 300,
      { timeout: 8000 }
    ).catch(() => null);
    if (okResp) proof = true;
  }

  // C) Footer code shows a concrete endpoint (after first success)
  if (!proof) {
    const footer = page.locator("code:has-text('/api/edge/ingest'), code:has-text('/api/time-series/points')").first();
    if (await footer.isVisible({ timeout: 6000 }).catch(() => false)) proof = true;
  }

  expect(proof, "Could not conclusively observe ingest running via UI/network/footer").toBeTruthy();
});
