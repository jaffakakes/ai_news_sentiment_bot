# Architecture: the life of a Vibe bubble

This document traces exactly what happens, step by step, so you can extend the
app with a correct mental model instead of guessing.

## The one object Apple gives you

Messages instantiates **one** `MSMessagesAppViewController`
(`MessagesViewController`) and *reuses* it for every context. You never get to
pick which screen shows — you **react to `presentationStyle`**:

| presentationStyle | What it means | What we show |
|---|---|---|
| `.compact` | User tapped our icon; small area above keyboard | `PickerViewController` (grid) |
| `.expanded` | User (or we) asked for the full sheet | `PickerViewController` (grid or reactions) |
| `.transcript` | **We are being drawn as a bubble in the chat** | `BubbleViewController` (live view) |

`.transcript` is the magic one. WWDC 2017 Session 234: *"the bubbles in the
transcript are also backed by a view controller — in fact the same class."*
That's how a bubble can be interactive: it's a real view controller, not a
picture.

## Sending a new bubble

```
PickerViewController  (user taps a vibe)
   └─▶ MessagesViewController.picker(_:didPick:caption:)
         └─▶ VibeState(vibeID:caption:)          // model
               └─▶ .makeMessage()                 // MSMessage with:
                     • message.url = encoded state
                     • layout = MSMessageLiveLayout(alternateLayout: template)
               └─▶ conversation.insert(message)   // stages in input field
```

The user still presses the blue send arrow — extensions can *stage* a message
but the human sends it. That's an Apple rule (no silent sending).

## Receiving / rendering a bubble

On a device **with the app**, when the bubble scrolls into view:

```
Messages sets presentationStyle = .transcript
   └─▶ MessagesViewController.render(for:)
         └─▶ VibeState(url: conversation.selectedMessage?.url)   // decode
               └─▶ BubbleViewController(state:)                   // draw + animate
```

On a device **without the app**, none of the above runs — Messages just shows
the `MSMessageTemplateLayout` image + caption we packed as the alternate layout.
That's the fallback, and it's why the app degrades instead of breaking.

## Reacting (the live in-place update)

The subtle part. Sending needs the input field, which only exists in
`.compact`/`.expanded`. So:

```
BubbleViewController  (user taps bubble in transcript)
   └─▶ onReactTapped()  →  requestPresentationStyle(.expanded)
         └─▶ render() now sees a selectedMessage → PickerViewController in "react" mode
               └─▶ user taps a reaction
                     └─▶ MessagesViewController.picker(_:didReact:to:session:)
                           └─▶ state.adding(reaction).makeMessage(session: originalSession)
                                 │                                   ▲
                                 │        SAME session id  ──────────┘
                                 └─▶ conversation.insert(...)
```

**Reusing the original `MSSession` is the whole trick.** When you insert a
message that shares a session with an existing bubble, Messages *replaces* that
bubble in place (for everyone in the chat) instead of appending a new one. New
session = new bubble; same session = update. This is exactly how a poll's counts
tick up in-place.

## Why state lives in a URL

A message can't ferry a live Swift object graph across the network — it ferries
a URL. So `VibeState` is the serialization boundary:

- **encode:** `VibeState → URLQueryItem[] → message.url`
- **decode:** `message.url → URLComponents.queryItems → VibeState`

Keep everything you need to redraw the bubble expressible as query items and the
bubble will reconstruct perfectly on any device. This caps how much state a
bubble can hold (URLs aren't huge), which is why game apps encode compactly.

## Extension points (where to plug new ideas)

- **`GradientVibeView`** is the "media" surface. It's a plain `UIView`. Replace
  its internals with:
  - `AVPlayerLayer` → looping video bubble
  - a GIF decoder → real Giphy/Tenor bubble
  - `WKWebView` → HTML/canvas/WebGL bubble (keep it light)
- **`Vibe.catalog`** is the content source. Swap the static array for an
  API-backed search.
- **`VibeState`** is the state schema. Add fields (scores, timestamps, paths)
  and they ride along in the URL automatically.
