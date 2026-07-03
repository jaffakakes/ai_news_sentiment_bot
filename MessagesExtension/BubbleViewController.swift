//
//  BubbleViewController.swift
//  The live, interactive bubble as it appears INSIDE the conversation transcript.
//
//  When a Vibe message scrolls into view on a device that has the app, Messages
//  instantiates our extension with presentationStyle == .transcript and shows
//  THIS view controller's view right inside the chat bubble. It reads the
//  message's state from the URL and draws the animated gradient + caption +
//  a reactions row. Tapping asks to expand so the user can add their reaction.
//

import UIKit
import Messages

final class BubbleViewController: UIViewController {

    private let state: VibeState
    private let onReactTapped: () -> Void

    private let gradientView = GradientVibeView()
    private let captionLabel = UILabel()
    private let reactionsLabel = UILabel()
    private let hintLabel = UILabel()

    init(state: VibeState, onReactTapped: @escaping () -> Void) {
        self.state = state
        self.onReactTapped = onReactTapped
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()

        // --- The "media" half: animated gradient + emoji ---
        gradientView.configure(with: state.vibe)
        gradientView.layer.cornerRadius = 16
        gradientView.clipsToBounds = true
        gradientView.translatesAutoresizingMaskIntoConstraints = false

        // --- The "message" half: caption + reactions tally ---
        captionLabel.text = state.caption.isEmpty ? state.vibe.title : state.caption
        captionLabel.font = .boldSystemFont(ofSize: 16)
        captionLabel.textColor = .label
        captionLabel.numberOfLines = 2

        reactionsLabel.text = reactionSummary()
        reactionsLabel.font = .systemFont(ofSize: 15)
        reactionsLabel.textColor = .secondaryLabel

        hintLabel.text = "Tap to react ›"
        hintLabel.font = .systemFont(ofSize: 12, weight: .medium)
        hintLabel.textColor = .tertiaryLabel

        let textStack = UIStackView(arrangedSubviews: [captionLabel, reactionsLabel, hintLabel])
        textStack.axis = .vertical
        textStack.spacing = 2
        textStack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(gradientView)
        view.addSubview(textStack)

        NSLayoutConstraint.activate([
            gradientView.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),
            gradientView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
            gradientView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),
            gradientView.heightAnchor.constraint(equalToConstant: 120),

            textStack.topAnchor.constraint(equalTo: gradientView.bottomAnchor, constant: 8),
            textStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            textStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            textStack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -8),
        ])

        // Whole bubble is tappable.
        view.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap)))
    }

    private func reactionSummary() -> String {
        guard state.totalReactions > 0 else { return "No reactions yet" }
        return state.reactions
            .sorted { $0.value > $1.value }
            .map { "\($0.key) \($0.value)" }
            .joined(separator: "   ")
    }

    @objc private func handleTap() {
        gradientView.pop()
        // Sending requires the input field, which only exists when expanded —
        // so a tap in the transcript asks the host to expand us. The picker
        // then handles composing the updated (reacted) message.
        onReactTapped()
    }
}
