//
//  VibeState.swift
//  The bridge between "an interactive bubble" and "bytes that fit in a message".
//
//  This is the heart of the whole app. An MSMessage can't carry a live object
//  graph across the network — it carries a URL. So we encode the entire state
//  of a bubble (which vibe, who sent it, how many of each reaction) into the
//  query items of `message.url`, and decode it back on the other device to
//  redraw the bubble. Same pattern Apple's own sample games use.
//

import Messages

struct VibeState {

    var vibeID: String
    var caption: String
    /// reaction emoji -> count. This is the part that changes "live".
    var reactions: [String: Int]

    var vibe: Vibe { Vibe.find(vibeID) }

    init(vibeID: String, caption: String, reactions: [String: Int] = [:]) {
        self.vibeID = vibeID
        self.caption = caption
        self.reactions = reactions
    }

    // MARK: Encode  →  message.url

    /// Serialize into a URL. The scheme/host are irrelevant (the OS never
    /// navigates to it for a live layout) — only the query items matter.
    var url: URL {
        var components = URLComponents()
        components.scheme = "vibecheck"
        components.host = "bubble"
        var items = [
            URLQueryItem(name: "vibe", value: vibeID),
            URLQueryItem(name: "caption", value: caption),
        ]
        for (emoji, count) in reactions where count > 0 {
            items.append(URLQueryItem(name: "react_\(emoji)", value: String(count)))
        }
        components.queryItems = items
        return components.url!
    }

    // MARK: Decode  ←  message.url

    /// Rebuild state from an incoming message. Returns nil for anything that
    /// isn't one of ours, so foreign bubbles are simply ignored.
    init?(url: URL?) {
        guard
            let url = url,
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            let items = components.queryItems
        else { return nil }

        var vibeID: String?
        var caption = ""
        var reactions: [String: Int] = [:]

        for item in items {
            switch item.name {
            case "vibe":
                vibeID = item.value
            case "caption":
                caption = item.value ?? ""
            default:
                if item.name.hasPrefix("react_"), let value = item.value, let count = Int(value) {
                    let emoji = String(item.name.dropFirst("react_".count))
                    reactions[emoji] = count
                }
            }
        }

        guard let id = vibeID else { return nil }
        self.init(vibeID: id, caption: caption, reactions: reactions)
    }

    // MARK: Mutation

    /// Add one reaction. Returns a new state (value semantics keep this safe
    /// to call from anywhere).
    func adding(_ reaction: Reaction) -> VibeState {
        var next = self
        next.reactions[reaction.rawValue, default: 0] += 1
        return next
    }

    var totalReactions: Int { reactions.values.reduce(0, +) }
}

// MARK: - Building the actual MSMessage

extension VibeState {

    /// Compose the message that gets inserted into the conversation.
    ///
    /// - `session`: pass the *existing* session when updating a bubble so the
    ///   old bubble is replaced in place (the live-poll trick). Pass nil for a
    ///   brand-new bubble.
    ///
    /// The message carries BOTH layouts:
    ///   • `MSMessageLiveLayout`  — the rich, interactive, animated bubble that
    ///     people *with the app* see, rendered by our own view controller.
    ///   • `MSMessageTemplateLayout` (the alternate) — a static image + caption
    ///     that everyone *without the app* sees. This is the graceful fallback
    ///     that answers "what if my friend doesn't have it?".
    func makeMessage(session: MSSession? = nil) -> MSMessage {
        let message = MSMessage(session: session ?? MSSession())
        message.url = url

        // Fallback for recipients without the app / on old iOS.
        let template = MSMessageTemplateLayout()
        template.image = FallbackRenderer.image(for: self)
        template.caption = caption.isEmpty ? vibe.title : caption
        template.subcaption = totalReactions > 0 ? "\(totalReactions) reactions" : "Tap to react"

        // The live, interactive layout. The template is its alternate.
        message.layout = MSMessageLiveLayout(alternateLayout: template)

        // A spoken/notification summary (accessibility + lock screen).
        message.summaryText = "\(vibe.emoji) \(caption.isEmpty ? vibe.title : caption)"
        return message
    }
}
