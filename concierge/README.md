# Concierge — the agent behind the bubble

An **AI agent that completes tasks *with* you and a friend, inside an iMessage
thread.** You describe a goal ("find us an Airbnb in Lisbon, 2 nights, walkable,
under €150"); the agent researches options with tools, proposes a shortlist as
an interactive bubble, both of you vote, and it finalizes on confirmation.

This folder is the **brain**. It runs on a server; the iMessage app is a thin
client that calls it. The extension never holds an API key or runs a model.

## How it works

```
 iMessage app  ──POST /concierge──▶  this server (FastAPI)
   {intent, participants, votes}          │
                                          ▼
                             Claude Opus 4.8 + TOOL USE
                             (search_listings, compare, draft_booking)
                                          │
   {message, proposals, needs_confirmation} ◀── structured, validated
```

- **`tools.py`** — the agent's tools. Currently **mocked** (realistic fake data,
  zero API partnerships). Swap each function body for a real provider — a travel
  aggregator, a commerce/search API, Apple Pay/Stripe for payment — without
  touching the agent, server, or app.
- **`agent.py`** — Claude Opus 4.8 driving the tool loop via the SDK's tool
  runner, then a structured-output pass that produces the exact shortlist the
  bubble renders (`ConciergeReply`). The agent **proposes; it never books** — a
  human confirms and sends from Messages (Apple requires the human tap anyway,
  which is a good consent gate for shared spending).
- **`server.py`** — one HTTPS endpoint the app calls.

## Run it

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...        # or: ant auth login
uvicorn server:app --reload --port 8000
```

Test without the app:

```bash
curl -s localhost:8000/concierge -H 'content-type: application/json' -d '{
  "intent": "Airbnb in Lisbon, 2 nights, under 150, walkable",
  "participants": ["Me", "Alex"]
}' | python -m json.tool
```

You'll get back something like:

```json
{
  "message": "Alfama studio is the walkable, well-priced pick.",
  "proposals": [
    {"id": "lx-01", "title": "Sunlit studio in Alfama", "subtitle": "Alfama · walkable, quiet",
     "price": "€120 / night", "highlights": ["walk score 95", "4.8★"]},
    ...
  ],
  "needs_confirmation": true
}
```

## Connecting the iMessage app

Point `ConciergeClient.baseURL` (in `MessagesExtension/ConciergeClient.swift`) at
this server. For the **Simulator** talking to a server on the same Mac, use
`http://localhost:8000` and add an App Transport Security exception for localhost
(see the app's README). In production, host this behind **HTTPS** and use that
URL — no ATS exception needed.

## Where to take it

- **Real tools:** replace the mocked bodies in `tools.py`. The function
  signatures are the contract — the agent adapts automatically.
- **More tasks:** the same shape works for group shopping, restaurant picks,
  gift-splitting — add tools, keep the `proposals` contract.
- **Payments:** add a `charge` tool gated behind the human confirmation step.
- **Memory:** give the agent a memory tool so it remembers the group's taste
  across threads.
