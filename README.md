# Vibe Check — an interactive iMessage bubble

A working proof that you *can* build the thing you imagined: a message bubble
that isn't just text or a static GIF, but a **custom, animated, interactive
surface** rendered right inside the conversation — "half media, half message."

This is built the same way Giphy, polls, Apple Cash, and iMessage games are:
an **iMessage App Extension** using Apple's **Messages framework** and
`MSMessageLiveLayout`. You don't replace or hack Messages — you plug a small
app *into* it, and Messages renders **your view controller inside the bubble.**

> **This must be built on a Mac with Xcode.** It's Swift + UIKit for iOS. It
> cannot compile or run in a Linux/CI container. The source is complete and
> ready — you open it in Xcode and hit Run.

---

## What it does

- **🧭 Ask Concierge — an AI agent that completes tasks *with* you and a friend
  in the thread.** Describe a goal ("Airbnb in Lisbon, 2 nights, walkable, under
  €150"); a Claude agent researches with tools, proposes a shortlist as an
  interactive bubble, **both people vote**, and it finalizes on confirmation.
  The agent proposes — a human always confirms and sends. Brain lives in
  [`concierge/`](concierge/) (Python + Claude Opus 4.8, tools mocked out of the box).
- **▶ Watch Feed — a TikTok-style vertical video feed** inside iMessage. Tap
  "Watch Feed" to open a full-screen swipeable feed (autoplaying, looping,
  tap-to-like, tap-to-unmute), and hit send on any clip to drop a preview
  bubble into the chat. Tapping that bubble opens the feed at that video.
  (Runs on free public sample clips out of the box — swap in your own.)
- A **picker** in the iMessage app drawer: choose a "vibe" (emoji + animated
  gradient) and send it.
- The sent bubble is a **live, animated `MSMessageLiveLayout`** — a color-
  shifting gradient with a floating emoji on top, caption below.
- **Tap the bubble → react.** Your reaction updates the bubble **in place for
  both people** (the same trick a live poll uses to tick up its vote count),
  because the update reuses the message's `MSSession`.
- **No app? No problem.** Anyone without the extension automatically sees a
  clean static image + caption (the `MSMessageTemplateLayout` fallback). It
  degrades gracefully instead of breaking.
- **Zero API keys, zero network.** Everything renders in code, so it works the
  instant you press Run. Swap in Giphy/Tenor/video later without rearchitecting.

---

## The mental model (why it works)

Interactivity means *running code*, and code runs only where it physically
lives. So the interactive bubble runs **your extension's code on each device
that has the app installed.** The message itself only carries a **URL** across
the network — we encode the entire bubble state (which vibe, the reaction
counts) into `message.url` query items, and decode it on the other side to
redraw. That's the whole architecture in one sentence.

```
   Sender picks a vibe
        │
        ▼
   VibeState  ──encode──▶  message.url = vibecheck://bubble?vibe=hype&caption=…&react_🔥=3
        │                                   │
        │                                   ▼   (travels through iMessage)
        │                          Recipient's device
        │                                   │
   MSMessageLiveLayout ◀── has app? ──┬── yes ──▶ our BubbleViewController draws it (animated, tappable)
   MSMessageTemplateLayout ◀──────────┴── no  ──▶ static image + caption fallback
```

---

## File-by-file

| File | Role |
|------|------|
| `MessagesViewController.swift` | **The router.** Apple's `MSMessagesAppViewController` entry point. Decides, per presentation style, whether to show the picker or the in-bubble live view. |
| `PickerViewController.swift` | The compose UI (grid of vibes) and the react UI (reaction buttons) shown in the app drawer / expanded sheet. |
| `BubbleViewController.swift` | **The live bubble.** What Messages renders *inside the transcript* for people with the app. Reads state from the message URL, animates, handles taps. |
| `GradientVibeView.swift` | The custom-drawn animated "media" half (gradient + bobbing emoji). Swap its guts for `AVPlayerLayer` (video) or `WKWebView` (HTML) later. |
| `VibeState.swift` | **The bridge.** Encodes/decodes bubble state ⇄ `message.url`, and builds the `MSMessage` carrying both the live layout and the fallback template. |
| `Vibe.swift` | Plain-data model + the built-in vibe catalog + a hex-color helper. |
| `FallbackRenderer.swift` | Renders the static images shown to people without the app. |
| `FeedItem/VideoCell/FeedViewController/VideoState/VideoBubbleController.swift` | The TikTok-style video feed and its share-a-clip bubbles. |
| `ConciergeState.swift` | **Agentic layer.** Client mirror of the backend contract; encodes the agent's shortlist + votes into the message. |
| `ConciergeClient.swift` | Thin HTTPS client to the `concierge/` backend. |
| `ConciergeBubbleController.swift` / `ConciergeInteraction.swift` | The concierge bubble in-transcript, plus the expanded compose / vote / confirm UI. |
| `Info.plist` | Marks this bundle as an iMessage extension (payload-provider point + principal class). |

---

## Build & run (on a Mac)

Xcode needs to generate the project/signing itself, so you create the targets in
Xcode and drop these sources in. ~5 minutes:

1. **New project** → *iOS* → **iMessage Application** → name it `VibeCheck`.
   (This creates a host app + a `MessagesExtension` target wired together.)
2. In the generated **MessagesExtension** group, **delete** the placeholder
   `MessagesViewController.swift` Xcode made.
3. **Drag every `.swift` file** from this repo's `MessagesExtension/` folder into
   that group. When prompted, check **"Copy items if needed"** and make sure the
   **MessagesExtension target** (not the host app) is ticked.
4. Confirm the extension's **Info.plist** has
   `NSExtensionPrincipalClass = $(PRODUCT_MODULE_NAME).MessagesViewController`
   (the template usually sets this already; this repo's `Info.plist` shows the
   exact contents).
5. Select the **MessagesExtension** scheme, choose an **iOS Simulator** (e.g.
   iPhone 15), and press **⌘R**. The Messages simulator opens with a canned
   conversation.
6. Open the **app drawer** (the ✚/apps icon by the text field) → pick **Vibe
   Check** → tap a vibe to send it → tap the sent bubble to react.

To try it with a **real friend**, run on a physical device signed with your
Apple ID (free tier works for personal testing); to send to others you'll need
the app distributed via TestFlight/App Store.

### Running the Concierge agent

The 🧭 Concierge feature needs its backend running (see [`concierge/`](concierge/)):

```bash
cd concierge && pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...        # or: ant auth login
uvicorn server:app --reload --port 8000
```

For the **Simulator** to reach a server on the same Mac over `http://localhost`,
add this App Transport Security exception to the **MessagesExtension Info.plist**
(local dev only — production should use HTTPS, which needs no exception):

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true/>
</dict>
```

---

## Where to take it next

- **Real GIFs / video:** replace `GradientVibeView`'s gradient with a GIF
  decoder or an `AVPlayerLayer`. Nothing else changes — the bubble is just a
  UIView.
- **HTML / canvas / WebGL bubble:** drop a `WKWebView` into `BubbleViewController`
  for arbitrary in-bubble rendering (keep it lightweight — transcript bubbles
  should stay snappy).
- **Giphy/Tenor picker:** swap `Vibe.catalog` for an API-backed search grid.
- **Richer live state:** the `VibeState` ⇄ URL pattern extends to anything you
  can serialize — scores, drawings (as compact paths), turn-based game state.

---

## The honest limits

- **In-bubble interactivity requires the app on both ends.** People without it
  get the static fallback. That's an Apple security boundary (code can't run on a
  device that doesn't have it), not a bug you can code around.
- **Reaching everyone without an install** is a *different* architecture (rich
  link previews → a web page). This project deliberately chose the native,
  in-bubble path for the richest experience among people who install it.

---

## License

MIT.
