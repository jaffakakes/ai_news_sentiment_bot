/**
 * All beginner-facing help copy in one reviewable place. Written in plain
 * English for people new to trading — explain the idea, not the formula.
 */
export const HELP = {
  event: {
    newsUrl:
      "Paste a link to a news article, tweet, or exchange announcement. The tool reads it and fills in the fields below for you.",
    ticker:
      "The coin pair to study. BTCUSDT means Bitcoin priced in USDT, a token pegged to the US dollar.",
    eventTime:
      "The exact moment the news broke (or when you first saw it). The chart is centred on this point.",
    timezone:
      "The timezone of the time you typed above — pick the one the news timestamp was written in; the tool converts it for you.",
    market:
      "Where the price data comes from. Spot = buying the actual coin. Perp = the futures market where leveraged trading happens. Prices are nearly identical.",
    timeframe:
      "How much time each candle on the chart covers. 1m = one candle per minute. Smaller candles show more detail; bigger ones show the wider picture.",
    lookback:
      "How many minutes of price history to show before the event, so you can see what 'normal' looked like.",
    lookforward:
      "How many minutes to show after the event — this is where the market's reaction (if any) shows up.",
    headline:
      "The news headline this chart is about. Optional — it's just for your records.",
    source:
      "Where the news came from, e.g. coindesk or a tweet. Optional.",
    category:
      "What kind of news this was (listing, hack, ETF…). Lets you filter and compare saved events later.",
    url: "A link to the article or post, so you can find it again later.",
    notes:
      "Your own thoughts — what you expected to happen, and what actually did.",
  },

  sim: {
    direction:
      "LONG = you profit if the price goes up. SHORT = you profit if it goes down.",
    account:
      "Your total pretend account balance. Used to show what this one trade would do to the whole account.",
    margin:
      "The slice of your account you commit to this trade. It's roughly the most you can lose (plus fees) before liquidation.",
    leverage:
      "Multiplies your bet. With 10x, 500 of margin controls a 5,000 position — profits AND losses move 10 times faster.",
    entryPrice:
      "The price you buy (long) or sell (short) at. Pre-filled with the price at the moment of the news.",
    stopLoss:
      "A safety net: if the price moves against you this far, the trade closes automatically to cap your loss.",
    takeProfit:
      "A target: if the price reaches this level, the trade closes automatically and locks in the win.",
    manualExit:
      "A price where you'd choose to close the trade yourself, if neither the stop loss nor the take profit is hit first.",
    slippage:
      "In fast markets you rarely get the exact price you clicked. This adds a small, realistic penalty to your entry and exit prices.",
    takerFee:
      "The fee the exchange charges when your order executes immediately at the current market price.",
    makerFee:
      "The (usually smaller) fee when your order waits in the order book to be filled — like a take-profit order.",
  },

  simResults: {
    netPnl:
      "What you'd have made or lost after fees. 'On margin' compares it to the money you put into the trade; 'on account' to your whole balance.",
    positionSize:
      "The total value the trade controls: your margin multiplied by your leverage.",
    quantity: "How much of the coin the position holds.",
    effectiveEntry:
      "The entry price actually used, after slippage nudged it slightly against you.",
    effectiveExit:
      "The exit price actually used, after slippage. Take-profit orders fill at their exact price, so they skip slippage.",
    liquidation:
      "If the price hits roughly this level, the exchange force-closes the trade and your margin is gone. This is an estimate — real exchanges calculate it slightly differently.",
    grossPnl:
      "Profit or loss from the price move alone, before exchange fees are subtracted.",
    fees: "Total exchange fees paid to open and close the trade.",
    riskReward:
      "How much you stood to win versus lose. 1 : 2 means you risked $1 to potentially make $2.",
    mfe: "The most this trade was ever 'up' while it was open. Traders call it maximum favourable excursion.",
    mae: "The most this trade was ever 'down' while it was open. Traders call it maximum adverse excursion.",
    timeInTrade: "How long the trade stayed open, from entry to exit.",
  },

  exitReasons: {
    TAKE_PROFIT: "The price reached your target, so the trade closed with a win.",
    STOP_LOSS:
      "The price hit your safety-net level, so the trade closed to cap the loss.",
    MANUAL_EXIT: "The trade closed at the exit price you chose.",
    LIQUIDATED:
      "Losses ate through your margin, so the exchange force-closed the trade. The margin is gone.",
    WINDOW_END:
      "The price never reached any of your exit levels, so the trade was closed at the last price in the chart window.",
  },

  stats: {
    priceBefore:
      "The price shortly before the news — the 'calm before' reference point.",
    priceAtEvent: "The price at the exact moment of the news.",
    highAfter:
      "The highest price reached after the event, and how far above the event price that is.",
    lowAfter:
      "The lowest price reached after the event, and how far below the event price that is.",
    timeToHigh: "How long after the news it took to reach the highest price.",
    timeToLow: "How long after the news it took to reach the lowest price.",
    returnHorizon:
      "How much the price had changed this long after the event, compared with the price at the event.",
    returnMissing:
      "No candle exists exactly at this time, so no value is shown.",
    volatilityPost:
      "How jumpy the price was after the event, minute to minute. Higher = wilder swings.",
    volumeBefore:
      "How much money changed hands in the window before the event.",
    volumeAfter:
      "How much money changed hands after the event. A big jump means the news got real attention.",
    volumeChange:
      "Trading activity after the event versus before, in percent. +100% means twice as much trading.",
    avgCandleRange:
      "The average size of each candle's price swing — another feel for how wild the move was.",
    candleCount:
      "How many candles of data exist before and after the event. Fewer than expected can mean gaps in the exchange's data.",
  },

  badges: {
    ambiguousCandle:
      "Your take profit and stop loss both fell inside the same candle. The data can't show which was hit first, so the worse outcome (stop loss) is assumed.",
    liqTouched:
      "The price touched the estimated liquidation level during the trade, even though it exited another way. In a real trade you might have been liquidated.",
    partialData:
      "The exchange returned less history than requested. Everything shown covers only the candles that exist.",
    researchTool:
      "This tool studies historical data and simulates pretend trades. It never places real trades and never connects to exchange trading accounts.",
    rom: "Return on margin: profit or loss as a percentage of the margin you put into that trade.",
    oneSecondPerp:
      "Binance's futures market only provides candles down to 1 minute. 1-second candles exist on Spot only.",
  },
} as const;
