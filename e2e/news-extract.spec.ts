import { expect, test } from "@playwright/test";
import btcFixture from "../src/test/fixtures/btc-event-1m.json";

/**
 * Network-mocked extraction flow: /api/news/extract and /api/candles are
 * intercepted, so this runs without internet or a database. The extraction
 * response reuses the BTC ETF-approval window so the mocked candles line up
 * with the "event time".
 */

const fixtureCandles = (btcFixture as { candles: unknown[] }).candles;

const EXTRACT_RESPONSE = {
  data: {
    news: {
      headline: "SEC approves spot Bitcoin ETFs",
      source: "generic-html",
      publisher: "CoinDesk",
      url: "https://www.coindesk.com/policy/sec-approves-etfs",
      canonicalUrl: "https://www.coindesk.com/policy/sec-approves-etfs",
      publishedAt: 1704920400000,
      publishedAtPrecision: "exact",
      summary: "The SEC approved the first spot bitcoin ETFs.",
      tickers: [
        {
          symbol: "BTCUSDT",
          baseAsset: "BTC",
          confidence: 0.8,
          matchedBy: "name-headline",
          matchedText: "bitcoin",
        },
      ],
    },
    suggested: { symbol: "BTCUSDT", market: "spot" },
    warnings: [],
  },
};

test("pasting a news URL auto-fills the form and generates the chart", async ({
  page,
}) => {
  await page.route("**/api/news/extract", (route) =>
    route.fulfill({ json: EXTRACT_RESPONSE }),
  );
  await page.route("**/api/candles?*", (route) =>
    route.fulfill({
      json: {
        data: {
          candles: fixtureCandles,
          partial: false,
          actualStart: 1704916800000,
          actualEnd: 1704927659999,
        },
      },
    }),
  );

  await page.goto("/");
  await page.fill("#news-url", "https://www.coindesk.com/policy/sec-approves-etfs");
  await page.getByRole("button", { name: "Extract" }).click();

  // Auto-fill assertions
  await expect(page.locator("#ticker")).toHaveValue("BTCUSDT", { timeout: 15000 });
  await expect(page.locator("#datetime")).toHaveValue(/2024-01-10T21:00/);
  await expect(page.locator("#headline")).toHaveValue("SEC approves spot Bitcoin ETFs");
  await expect(page.locator("#source")).toHaveValue("CoinDesk");

  // Auto-generate fired (exact precision + suggested ticker)
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20000 });
});

test("a failed extraction shows the honest error and leaves fields untouched", async ({
  page,
}) => {
  await page.route("**/api/news/extract", (route) =>
    route.fulfill({
      status: 422,
      json: {
        error: {
          code: "ACCESS_DENIED",
          message:
            "coinbase.com blocks automated access or requires login (HTTP 403) — no paywall bypass attempted.",
        },
      },
    }),
  );

  await page.goto("/");
  const headlineBefore = await page.locator("#headline").inputValue();
  await page.fill("#news-url", "https://www.coinbase.com/blog/some-post");
  await page.getByRole("button", { name: "Extract" }).click();

  await expect(
    page.getByText(/no paywall bypass attempted/),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#headline")).toHaveValue(headlineBefore);
});
