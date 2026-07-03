//
//  FeedItem.swift
//  One video in the TikTok-style feed.
//
//  Plain data: a video URL, who "posted" it, and a caption. The catalog uses
//  free public sample videos so the feed plays the instant you run it — swap
//  `catalog` for your own CDN/server URLs (or bundled files) later without
//  touching the feed UI.
//

import Foundation

struct FeedItem: Equatable {

    let id: String
    let videoURL: URL
    let author: String
    let caption: String
    /// Starting like count — the tap-to-like adds on top of this locally.
    let likes: Int

    /// Built-in demo feed. These are Google's long-standing public sample
    /// clips over HTTPS (no App Transport Security exception needed). Replace
    /// with your own vertical videos for the real thing.
    static let catalog: [FeedItem] = [
        FeedItem(id: "bunny",
                 videoURL: URL(string: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4")!,
                 author: "@bigbuck", caption: "when the drop hits 🐰🔥", likes: 1240),
        FeedItem(id: "blazes",
                 videoURL: URL(string: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4")!,
                 author: "@blaze", caption: "POV: it's finally friday", likes: 8820),
        FeedItem(id: "escapes",
                 videoURL: URL(string: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4")!,
                 author: "@escape", caption: "road trip core 🚗💨", likes: 431),
        FeedItem(id: "joyrides",
                 videoURL: URL(string: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4")!,
                 author: "@joyride", caption: "send this to your bestie", likes: 15200),
        FeedItem(id: "fun",
                 videoURL: URL(string: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4")!,
                 author: "@funhouse", caption: "no thoughts just vibes ✨", likes: 671),
    ]

    static func find(_ id: String) -> FeedItem {
        catalog.first { $0.id == id } ?? catalog[0]
    }

    var index: Int {
        FeedItem.catalog.firstIndex(of: self) ?? 0
    }
}
