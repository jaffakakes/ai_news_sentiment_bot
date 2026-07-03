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

    /// Poster image for a shared video clip — a dark card with a play glyph and
    /// the caption. Used as the preview bubble and the no-app fallback.
    static func videoPoster(for item: FeedItem, size: CGSize = CGSize(width: 300, height: 200)) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            // Dark gradient backdrop.
            let colors = [UIColor(white: 0.12, alpha: 1).cgColor, UIColor(white: 0.02, alpha: 1).cgColor]
            let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                      colors: colors as CFArray, locations: [0, 1])!
            ctx.cgContext.drawLinearGradient(
                gradient, start: .zero,
                end: CGPoint(x: size.width, y: size.height), options: [])

            // Play triangle in a circle, centered.
            let d: CGFloat = 68
            let circle = CGRect(x: (size.width - d) / 2, y: (size.height - d) / 2 - 8, width: d, height: d)
            UIColor.white.withAlphaComponent(0.9).setFill()
            ctx.cgContext.fillEllipse(in: circle)
            let t = UIBezierPath()
            let cx = circle.midX + 4, cy = circle.midY
            t.move(to: CGPoint(x: cx - 10, y: cy - 14))
            t.addLine(to: CGPoint(x: cx - 10, y: cy + 14))
            t.addLine(to: CGPoint(x: cx + 16, y: cy))
            t.close()
            UIColor.black.setFill()
            t.fill()

            // Author + caption at the bottom.
            let line = "\(item.author) · ▶ Tap to watch" as NSString
            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 14),
                .foregroundColor: UIColor.white,
            ]
            let s = line.size(withAttributes: attrs)
            line.draw(at: CGPoint(x: (size.width - s.width) / 2, y: size.height - 30), withAttributes: attrs)
        }
    }

    /// Poster for a concierge bubble — the agent's headline pick, used as the
    /// preview image and the no-app fallback.
    static func conciergePoster(for state: ConciergeState, size: CGSize = CGSize(width: 300, height: 200)) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let colors = [UIColor(hex: "1D2671").cgColor, UIColor(hex: "C33764").cgColor]
            let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                      colors: colors as CFArray, locations: [0, 1])!
            ctx.cgContext.drawLinearGradient(
                gradient, start: .zero,
                end: CGPoint(x: size.width, y: size.height), options: [])

            let emoji = (state.confirmedID != nil ? "✅" : "🧭") as NSString
            emoji.draw(at: CGPoint(x: 16, y: 14),
                       withAttributes: [.font: UIFont.systemFont(ofSize: 40)])

            let title = (state.topPick?.title ?? "Concierge") as NSString
            title.draw(at: CGPoint(x: 16, y: 74), withAttributes: [
                .font: UIFont.boldSystemFont(ofSize: 20), .foregroundColor: UIColor.white,
            ])

            let sub = state.message as NSString
            sub.draw(in: CGRect(x: 16, y: 108, width: size.width - 32, height: 70), withAttributes: [
                .font: UIFont.systemFont(ofSize: 14), .foregroundColor: UIColor(white: 1, alpha: 0.85),
            ])
        }
    }
}
