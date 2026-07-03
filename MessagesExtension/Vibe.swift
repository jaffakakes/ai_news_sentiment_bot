//
//  Vibe.swift
//  The data model for a single interactive "vibe" bubble.
//
//  A Vibe is the *content* of the bubble: an emoji, a title, and a two-color
//  gradient that we animate in the transcript. Everything here is plain data
//  with no UIKit dependency so it is trivial to encode into an MSMessage.url
//  and decode again on the recipient's device.
//

import UIKit

/// One selectable "vibe". This is the palette the picker shows and the thing
/// that gets serialized into a message.
struct Vibe: Equatable {

    let id: String
    let emoji: String
    let title: String
    /// Two hex colors ("RRGGBB") that we animate between in the live bubble.
    let colorA: String
    let colorB: String

    /// The built-in catalog. No network, no API keys — this is why the demo
    /// runs the instant you hit ⌘R in Xcode. Swap this for a Giphy/Tenor/video
    /// fetch later without touching the rest of the architecture.
    static let catalog: [Vibe] = [
        Vibe(id: "hype",   emoji: "🔥", title: "Hype",   colorA: "FF512F", colorB: "F09819"),
        Vibe(id: "chill",  emoji: "🧊", title: "Chill",  colorA: "2193B0", colorB: "6DD5ED"),
        Vibe(id: "love",   emoji: "💜", title: "Love",   colorA: "C33764", colorB: "1D2671"),
        Vibe(id: "money",  emoji: "💸", title: "Money",  colorA: "11998E", colorB: "38EF7D"),
        Vibe(id: "chaos",  emoji: "🌀", title: "Chaos",  colorA: "8E2DE2", colorB: "4A00E0"),
        Vibe(id: "sleepy", emoji: "😴", title: "Sleepy", colorA: "355C7D", colorB: "C06C84"),
    ]

    static func find(_ id: String) -> Vibe {
        catalog.first { $0.id == id } ?? catalog[0]
    }
}

/// The reactions people can tap onto a bubble. Kept tiny on purpose.
enum Reaction: String, CaseIterable {
    case fire   = "🔥"
    case laugh  = "😂"
    case heart  = "❤️"
    case wow    = "😮"

    var key: String { "r_\(rawValue.unicodeScalars.first!.value)" }
}

// MARK: - Hex color helper

extension UIColor {
    /// Build a color from an "RRGGBB" string. Falls back to gray on bad input
    /// so a malformed message can never crash the bubble.
    convenience init(hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)
        let r = CGFloat((value & 0xFF0000) >> 16) / 255
        let g = CGFloat((value & 0x00FF00) >> 8) / 255
        let b = CGFloat(value & 0x0000FF) / 255
        if hex.count == 6 {
            self.init(red: r, green: g, blue: b, alpha: 1)
        } else {
            self.init(white: 0.5, alpha: 1)
        }
    }
}
