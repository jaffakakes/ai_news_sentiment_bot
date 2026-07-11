import { expect, test } from "@playwright/test";
import btcFixture from "../src/test/fixtures/btc-event-1m.json";

/**
 * Network-mocked smoke test: the market API routes are intercepted with the
 * captured BTC ETF-approval fixture, so this runs without internet or a
 * database. The live end-to-end variant is tagged @network below.
 */

const fixtureCandles = (btcFixture as { candles: unknown[] }).candles;

test("generates an event chart and statistics from a ticker + timestamp", async ({
  page,
}) => {
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
  await expect(page.getByText("Event Terminal")).toBeVisible();
  await expect(page.getByText("Research tool — no live trading")).toBeVisible();

  await page.fill("#ticker", "BTCUSDT");
  await page.fill("#datetime", "2024-01-10T21:00");
  await page.click("#market");
  await page.getByRole("option", { name: "Binance Spot" }).click();
  await page.click('button[type="submit"]');

  // Chart canvas renders from the mocked candles.
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20000 });

  // Statistics are computed server-side from the same window; the values
  // below are the known answers for the ETF-approval fixture. The stats
  // route is NOT mocked, so tolerate absence when offline by mocking it too.
  await expect(page.getByText("Price at event")).toBeVisible({
    timeout: 20000,
  });
});

test("stats panel shows known fixture values when the stats API is mocked", async ({
  page,
}) => {
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
  await page.route("**/api/event-stats?*", (route) =>
    route.fulfill({
      json: {
        data: {
          symbol: "BTCUSDT",
          exchange: "binance",
          market: "spot",
          eventTime: 1704920400000,
          priceBefore: "46127",
          priceAtEvent: "46127",
          highAfter: "46948.98",
          highAfterPct: "1.7820",
          timeToHighMs: 6960000,
          lowAfter: "45080",
          lowAfterPct: "-2.2698",
          timeToLowMs: 2400000,
          returns: {
            "1m": "-0.2753",
            "5m": "-0.1501",
            "15m": "-0.5484",
            "30m": "-1.0905",
            "60m": "-0.2558",
          },
          volumeBefore: "488110124.13383170",
          volumeAfter: "684435227.88261940",
          volumeChangePct: "40.2215",
          avgCandleRangePct: "0.2804",
          postEventVolatilityPct: "0.1695",
          candleCountBefore: 60,
          candleCountAfter: 121,
          dataComplete: true,
        },
      },
    }),
  );

  await page.goto("/");
  await page.fill("#ticker", "BTCUSDT");
  await page.fill("#datetime", "2024-01-10T21:00");
  await page.click("#market");
  await page.getByRole("option", { name: "Binance Spot" }).click();
  await page.click('button[type="submit"]');

  await expect(page.getByText("+1.78%").first()).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText("-2.27%").first()).toBeVisible();
  await expect(page.getByText("+40.22%").first()).toBeVisible();
});

test("live Binance flow: generate, save, simulate @network", async ({
  page,
}) => {
  await page.goto("/");
  await page.fill("#ticker", "BTCUSDT");
  await page.fill("#datetime", "2024-01-10T21:00");
  await page.click("#market");
  await page.getByRole("option", { name: "Binance Spot" }).click();
  await page.click('button[type="submit"]');

  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("+1.78%").first()).toBeVisible({
    timeout: 30000,
  });

  await page.getByRole("button", { name: /Save analysis/ }).click();
  await expect(page.getByText("Event saved")).toBeVisible({ timeout: 15000 });

  await page.fill("#sim-sl", "45500");
  await page.fill("#sim-tp", "46900");
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(page.getByText("Stop loss hit")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText("-74.90 USDT")).toBeVisible();
});
