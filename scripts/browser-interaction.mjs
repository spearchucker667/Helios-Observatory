#!/usr/bin/env node
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8081/";
const timeoutMs = Number(process.env.BROWSER_INTERACTION_TIMEOUT_MS || 30000);

console.log(`Starting headless browser interaction QA against ${url}...`);

const errors = {
  consoleErrors: [],
  pageErrors: [],
};

let browser = null;
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    errors.pageErrors.push(String(err?.message || err));
  });

  // Step 1: Navigate to observatory
  console.log("Step 1: Navigating to observatory...");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForSelector("canvas", { timeout: 10000 });
  await page.waitForTimeout(1000);

  const aside = page.locator("aside");
  await aside.waitFor({ state: "visible", timeout: 5000 });

  /**
   * Clicks a body entry and requires its detail card. A click issued while the
   * scene is still hydrating can be swallowed, so the selection is retried (and
   * Escape clears any partial selection) before the assertion is allowed to
   * fail — the assertion itself is never weakened.
   */
  async function selectBodyAndAssertDetail(buttonLocator, name) {
    const header = aside.locator(`h2:has-text("${name}")`);
    const attempt = async () => {
      await buttonLocator.waitFor({ state: "visible", timeout: 5000 });
      await buttonLocator.click();
      try {
        await header.waitFor({ state: "visible", timeout: 2500 });
        return true;
      } catch {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(250);
        return false;
      }
    };
    for (let i = 0; i < 3; i++) {
      if (await attempt()) return;
    }
    throw new Error(`Selecting ${name} never produced its detail card`);
  }

  // Step 2: Test Planet Selection (Mars)
  console.log("Step 2: Testing planet selection (Mars)...");
  await selectBodyAndAssertDetail(page.locator('button:has-text("Mars")').first(), "Mars");
  console.log("✓ Planet selection verified: Mars detail card displayed");

  // Step 3: Test Calipers / Scientific Measurement Panel
  console.log("Step 3: Testing caliper toggle...");
  const caliperBtn = page.locator('button[aria-label*="caliper" i]').first();
  await caliperBtn.waitFor({ state: "visible", timeout: 5000 });
  await caliperBtn.click();
  await page.waitForTimeout(500);

  const caliperPanel = page.locator('text="Astronomical Caliper"').first();
  await caliperPanel.waitFor({ state: "visible", timeout: 5000 });
  console.log("✓ Caliper toggle verified: Astronomical Caliper panel visible");

  // Close caliper panel
  await caliperBtn.click();
  await page.waitForTimeout(300);

  // Step 4: Test Search Palette Navigation for Planetary Body (Jupiter)
  console.log("Step 4: Testing search palette for celestial body (Jupiter)...");
  const searchBtn = page.locator('button[aria-label*="Search" i]').first();
  await searchBtn.click();
  await page.waitForTimeout(300);

  const searchInput = page.locator('input[placeholder*="Search" i]').first();
  await searchInput.waitFor({ state: "visible", timeout: 5000 });
  await searchInput.fill("Jupiter");
  await page.waitForTimeout(300);

  const jupiterHit = page.locator('[cmdk-item]:has-text("Jupiter")').first();
  const jupiterHeader = aside.locator('h2:has-text("Jupiter")');
  let jupiterSelected = false;
  for (let attempt = 0; attempt < 3 && !jupiterSelected; attempt++) {
    if (attempt > 0) {
      await searchBtn.click();
      await page.waitForTimeout(300);
      await searchInput.fill("Jupiter");
      await page.waitForTimeout(300);
    }
    await jupiterHit.waitFor({ state: "visible", timeout: 5000 });
    await jupiterHit.click();
    try {
      await jupiterHeader.waitFor({ state: "visible", timeout: 2500 });
      jupiterSelected = true;
    } catch {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
    }
  }
  if (!jupiterSelected) {
    throw new Error("Search palette selection never produced the Jupiter detail card");
  }
  console.log("✓ Search palette navigation verified: Jupiter selected and detailed");

  // Step 5: Test Deep Space Region Search Navigation (Kuiper Belt)
  console.log("Step 5: Testing deep space region search (Kuiper Belt)...");
  await searchBtn.click();
  await page.waitForTimeout(300);
  await searchInput.waitFor({ state: "visible", timeout: 5000 });
  await searchInput.fill("Kuiper Belt");
  await page.waitForTimeout(300);

  const kuiperHit = page.locator('[cmdk-item]:has-text("Kuiper Belt")').first();
  await kuiperHit.waitFor({ state: "visible", timeout: 5000 });
  await kuiperHit.click();
  await page.waitForTimeout(500);

  const kuiperHeader = aside.locator('h2:has-text("Kuiper Belt")');
  await kuiperHeader.waitFor({ state: "visible", timeout: 5000 });
  const observedStatus = aside.locator('text="Observed"').first();
  await observedStatus.waitFor({ state: "visible", timeout: 5000 });
  console.log("✓ Deep-space region navigation verified: Kuiper Belt card and status displayed");

  // Step 6: Verify console and page errors
  if (errors.consoleErrors.length > 0 || errors.pageErrors.length > 0) {
    console.error("Browser interaction failed with errors:", JSON.stringify(errors, null, 2));
    process.exitCode = 1;
  } else {
    console.log("✓ All interaction tests passed with zero console/page errors.");
    process.exitCode = 0;
  }
} catch (err) {
  console.error("Browser interaction test exception:", err);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
