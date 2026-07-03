//
//  GradientVibeView.swift
//  The custom-drawn, animated top half of the bubble.
//
//  This is the "half media" part of "half media / half message" — instead of a
//  GIF we render an animated gradient with a floating emoji, entirely in code.
//  Because it's just a UIView, you could later replace its guts with an
//  AVPlayerLayer (video), a WKWebView (HTML/canvas), or a GIF decoder without
//  changing anything else.
//

import UIKit

final class GradientVibeView: UIView {

    private let gradient = CAGradientLayer()
    private let emojiLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        gradient.startPoint = CGPoint(x: 0, y: 0)
        gradient.endPoint = CGPoint(x: 1, y: 1)
        layer.addSublayer(gradient)

        emojiLabel.font = .systemFont(ofSize: 44)
        emojiLabel.textAlignment = .center
        addSubview(emojiLabel)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        gradient.frame = bounds
        emojiLabel.frame = bounds
    }

    /// Point the view at a vibe and start the ambient animation.
    func configure(with vibe: Vibe) {
        emojiLabel.text = vibe.emoji
        let a = UIColor(hex: vibe.colorA).cgColor
        let b = UIColor(hex: vibe.colorB).cgColor
        gradient.colors = [a, b]
        startAnimating(a: a, b: b)
    }

    private func startAnimating(a: CGColor, b: CGColor) {
        // Slowly rotate the gradient's color stops so it feels alive.
        let colorFlow = CABasicAnimation(keyPath: "colors")
        colorFlow.fromValue = [a, b]
        colorFlow.toValue = [b, a]
        colorFlow.duration = 3.0
        colorFlow.autoreverses = true
        colorFlow.repeatCount = .infinity
        gradient.add(colorFlow, forKey: "colorFlow")

        // Gently bob the emoji.
        let bob = CABasicAnimation(keyPath: "transform.translation.y")
        bob.fromValue = -6
        bob.toValue = 6
        bob.duration = 1.6
        bob.autoreverses = true
        bob.repeatCount = .infinity
        bob.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        emojiLabel.layer.add(bob, forKey: "bob")
    }

    /// A quick reaction pop, used when someone taps.
    func pop() {
        let pop = CAKeyframeAnimation(keyPath: "transform.scale")
        pop.values = [1.0, 1.3, 0.9, 1.0]
        pop.keyTimes = [0, 0.3, 0.6, 1.0]
        pop.duration = 0.35
        emojiLabel.layer.add(pop, forKey: "pop")
    }
}
