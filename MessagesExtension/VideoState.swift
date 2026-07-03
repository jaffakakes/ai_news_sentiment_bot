//
//  VideoState.swift
//  Encodes "a video clip was shared" into a message and back.
//
//  Same bridge pattern as VibeState: the message carries a URL whose query
//  items name which feed item this is. On the recipient's device we decode it
//  to show a preview bubble; tapping opens the feed at that clip.
//

import Messages

struct VideoState {

    var itemID: String
    var caption: String

    var item: FeedItem { FeedItem.find(itemID) }

    init(item: FeedItem) {
        self.itemID = item.id
        self.caption = item.caption
    }

    init(itemID: String, caption: String) {
        self.itemID = itemID
        self.caption = caption
    }

    // MARK: Encode → message.url

    var url: URL {
        var components = URLComponents()
        components.scheme = "vibecheck"
        components.host = "video"
        components.queryItems = [
            URLQueryItem(name: "item", value: itemID),
            URLQueryItem(name: "caption", value: caption),
        ]
        return components.url!
    }

    // MARK: Decode ← message.url

    init?(url: URL?) {
        guard
            let url = url,
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            components.host == "video",
            let items = components.queryItems,
            let id = items.first(where: { $0.name == "item" })?.value
        else { return nil }
        let caption = items.first(where: { $0.name == "caption" })?.value ?? ""
        self.init(itemID: id, caption: caption)
    }

    // MARK: Build the MSMessage

    func makeMessage() -> MSMessage {
        let message = MSMessage()
        message.url = url

        // Preview bubble = poster image + caption. This same template is the
        // fallback for people without the app, so everyone sees something.
        let template = MSMessageTemplateLayout()
        template.image = FallbackRenderer.videoPoster(for: item)
        template.caption = item.author
        template.subcaption = caption
        template.imageTitle = "▶ Tap to watch"
        message.layout = MSMessageLiveLayout(alternateLayout: template)
        message.summaryText = "📹 \(item.author): \(caption)"
        return message
    }
}
