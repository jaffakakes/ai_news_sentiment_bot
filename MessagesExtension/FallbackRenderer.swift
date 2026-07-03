//
//  FallbackRenderer.swift
//  Draws the static image shown to people WITHOUT the app.
//
//  When a recipient doesn't have the extension (or is on old iOS / non-Apple),
//  the live layout can't run their copy of our code, so the OS shows the
//  alternate MSMessageTemplateLayout instead. That template needs a plain
//  UIImage. We render one here that looks like a frozen frame of the live
//  bubble, so the fallback still feels intentional.
//

import UIKit

enum FallbackRenderer {

    static func image(for state: VibeState, size: CGSize = CGSize(width: 300, height: 200)) -> UIImage {
        let vibe = state.vibe
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let rect = CGRect(origin: .zero, size: size)

            // Gradient background matching the vibe.
            let colors = [UIColor(hex: vibe.colorA).cgColor, UIColor(hex: vibe.colorB).cgColor]
            let gradient = CGGradient(
                colorsSpace: CGColorSpaceCreateDeviceRGB(),
                colors: colors as CFArray,
                locations: [0, 1]
            )!
            ctx.cgContext.drawLinearGradient(
                gradient,
                start: .zero,
                end: CGPoint(x: size.width, y: size.height),
                options: []
            )

            // The emoji, centered.
            let emoji = vibe.emoji as NSString
            let emojiAttrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 72)]
            let emojiSize = emoji.size(withAttributes: emojiAttrs)
            emoji.draw(
                at: CGPoint(x: (size.width - emojiSize.width) / 2,
                            y: (size.height - emojiSize.height) / 2 - 16),
                withAttributes: emojiAttrs
            )

            // Reaction tally, if any.
            if state.totalReactions > 0 {
                let summary = "\(state.totalReactions) reactions" as NSString
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.boldSystemFont(ofSize: 16),
                    .foregroundColor: UIColor.white,
                ]
                let s = summary.size(withAttributes: attrs)
                summary.draw(
                    at: CGPoint(x: (size.width - s.width) / 2, y: size.height - 34),
                    withAttributes: attrs
                )
            }
        }
    }
}
