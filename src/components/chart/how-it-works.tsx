/**
 * Beginner intro card shown in the empty chart area before any chart is
 * generated. Copy must not duplicate strings the e2e suite asserts with
 * strict getByText ("Event Terminal", "Price at event", the header badge).
 */
const STEPS = [
  {
    title: "Pick a coin and the time the news broke",
    detail: "Fill in the panel on the left. Any coin on Binance, any moment in the past.",
  },
  {
    title: "See what the price actually did",
    detail:
      "A candle chart appears here, centred on your moment, with plain-number stats below.",
  },
  {
    title: "Replay a practice trade",
    detail:
      "Use the simulator on the right with pretend money. Nothing real is ever traded.",
  },
];

export function HowItWorks() {
  return (
    <div className="flex h-full min-h-32 items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-border/60 bg-card/50 p-6">
        <h3 className="mb-4 text-sm font-medium">How this works</h3>
        <ol className="flex flex-col gap-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs text-muted-foreground"
              >
                {i + 1}
              </span>
              <div>
                <p className="text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground/70">
          Try it: BTCUSDT · 2024-01-10 21:00 UTC — the day spot Bitcoin ETFs
          were approved.
        </p>
      </div>
    </div>
  );
}
