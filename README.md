# Event Terminal

A research terminal for crypto news events. Enter a ticker and a timestamp (or, in a future phase, paste a news URL) and the app builds an event-centred candlestick chart from historical Binance data, computes market statistics around the event, and lets you simulate what a hypothetical leveraged futures trade would have done.

> **Educational and research use only.** This application never places trades, never connects to exchange trading APIs, and never recommends trades. It only analyses historical market data and calculates hypothetical outcomes.

## Features

- **Event-centred charts** — TradingView Lightweight Charts with candlesticks, volume, and a vertical event marker at the news timestamp. Timeframes: 1s (spot only), 1m, 5m, 15m, 1h.
- **Event statistics** — price before/at the event, highest/lowest move after, returns at +1/5/15/30/60 minutes, time to peak/low, volume change, average candle range, post-event volatility.
- **Trade simulator** — hypothetical long/short leveraged futures positions with margin, leverage, entry, stop loss, take profit, fees and slippage. Computes position size, an isolated-margin liquidation estimate, MFE/MAE, gross/net PnL, return on margin/account, risk/reward, and whether TP or SL would have been hit first by walking the actual candle series. All financial math uses decimal arithmetic — never floating point.
- **Saved analyses** — events, statistics snapshots and simulations persist to PostgreSQL and can be filtered by ticker, date, source, exchange and category.

## Data honesty

The app never invents market data, never fabricates timestamps, and never interpolates missing candles. If Binance has no data for a window (e.g. the symbol didn't trade yet), the app says so. Simulations flag ambiguous candles where both TP and SL fell inside one bar (resolved conservatively as a stop-loss).

## Setup

```bash
npm install
cp .env.example .env   # add your hosted PostgreSQL DATABASE_URL (Neon/Supabase)
npm run db:push        # create tables
npm run dev            # http://localhost:3000
```

Market data comes from Binance public REST endpoints (spot `api.binance.com`, USDT-M futures `fapi.binance.com`), fetched server-side with caching and rate limiting. No API keys required.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `start` | Production build / serve |
| `npm test` | Vitest unit tests (simulation + statistics engines) |
| `npm run test:e2e` | Playwright smoke tests (network-mocked). Set `PLAYWRIGHT_NETWORK=1` to include live `@network` specs |
| `npm run typecheck` | TypeScript strict check |
| `npm run db:push` / `db:studio` | Prisma schema push / data browser |

## Architecture

- `src/lib/market` — `MarketProvider` interface with Binance spot and USDT-M futures implementations, pagination over the 1000-candle limit, in-memory LRU cache, token-bucket rate limiting. New exchanges plug in via `registry.ts`.
- `src/lib/news` — `NewsProvider` interface (Phase 3 seam) with a `ManualProvider` for hand-entered events.
- `src/lib/sim` — pure-function decimal simulation engine. Formulas documented in `engine.ts`.
- `src/lib/stats` — event statistics engine, always computed on 1m candles.
- `src/app/api` — route handlers (zod-validated, consistent error envelope, server-side only).
- `prisma/schema.prisma` — `Event`, `EventStats`, `TradeSimulation`.
