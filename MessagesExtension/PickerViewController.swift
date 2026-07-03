//
//  PickerViewController.swift
//  The compose UI shown in the keyboard area (.compact) and full sheet (.expanded).
//
//  Two jobs:
//   1. Brand-new bubble: show the grid of vibes; tapping one stages a message
//      in the input field for the user to send.
//   2. Reacting to an existing bubble: when the user taps a bubble in the
//      transcript we expand into this screen showing reaction buttons; tapping
//      one updates the SAME message (same session) so the bubble changes in
//      place for both people.
//

import UIKit
import Messages

protocol PickerDelegate: AnyObject {
    /// Stage a fresh vibe bubble into the input field.
    func picker(_ picker: PickerViewController, didPick vibe: Vibe, caption: String)
    /// Apply a reaction to the message the user tapped in the transcript.
    func picker(_ picker: PickerViewController, didReact reaction: Reaction, to state: VibeState, session: MSSession?)
    /// Open the full-screen swipeable video feed.
    func pickerDidRequestFeed(_ picker: PickerViewController)
}

final class PickerViewController: UIViewController {

    weak var delegate: PickerDelegate?

    /// When non-nil, we're in "react to this bubble" mode instead of compose mode.
    var reactingTo: (state: VibeState, session: MSSession?)?

    private let stack = UIStackView()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        stack.axis = .vertical
        stack.spacing = 12
        stack.alignment = .fill
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
        ])

        if let reacting = reactingTo {
            buildReactionUI(for: reacting.state)
        } else {
            buildComposeUI()
        }
    }

    // MARK: Compose mode — pick a vibe

    private func buildComposeUI() {
        // Headline action: jump into the swipeable video feed.
        var feedConfig = UIButton.Configuration.filled()
        feedConfig.title = "▶  Watch Feed"
        feedConfig.baseBackgroundColor = .label
        feedConfig.baseForegroundColor = .systemBackground
        feedConfig.cornerStyle = .large
        let feedButton = UIButton(configuration: feedConfig)
        feedButton.heightAnchor.constraint(equalToConstant: 52).isActive = true
        feedButton.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            self.delegate?.pickerDidRequestFeed(self)
        }, for: .touchUpInside)
        stack.addArrangedSubview(feedButton)

        let title = makeTitle("…or send a vibe")
        stack.addArrangedSubview(title)

        // Rows of 3 buttons.
        var row = makeRow()
        for (index, vibe) in Vibe.catalog.enumerated() {
            if index % 3 == 0 && index != 0 {
                stack.addArrangedSubview(row)
                row = makeRow()
            }
            row.addArrangedSubview(makeVibeButton(vibe))
        }
        stack.addArrangedSubview(row)
    }

    private func makeVibeButton(_ vibe: Vibe) -> UIButton {
        var config = UIButton.Configuration.filled()
        config.title = "\(vibe.emoji)\n\(vibe.title)"
        config.baseBackgroundColor = UIColor(hex: vibe.colorA)
        config.cornerStyle = .large
        config.titleAlignment = .center
        let button = UIButton(configuration: config)
        button.titleLabel?.numberOfLines = 2
        button.titleLabel?.textAlignment = .center
        button.heightAnchor.constraint(equalToConstant: 72).isActive = true
        button.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            self.delegate?.picker(self, didPick: vibe, caption: vibe.title)
        }, for: .touchUpInside)
        return button
    }

    // MARK: React mode — respond to an existing bubble

    private func buildReactionUI(for state: VibeState) {
        stack.addArrangedSubview(makeTitle("React to \(state.vibe.emoji) \(state.caption.isEmpty ? state.vibe.title : state.caption)"))

        let row = makeRow()
        for reaction in Reaction.allCases {
            var config = UIButton.Configuration.gray()
            config.title = reaction.rawValue
            config.cornerStyle = .large
            let button = UIButton(configuration: config)
            button.titleLabel?.font = .systemFont(ofSize: 32)
            button.heightAnchor.constraint(equalToConstant: 64).isActive = true
            button.addAction(UIAction { [weak self] _ in
                guard let self, let reacting = self.reactingTo else { return }
                self.delegate?.picker(self, didReact: reaction, to: reacting.state, session: reacting.session)
            }, for: .touchUpInside)
            row.addArrangedSubview(button)
        }
        stack.addArrangedSubview(row)
    }

    // MARK: Helpers

    private func makeTitle(_ text: String) -> UILabel {
        let label = UILabel()
        label.text = text
        label.font = .boldSystemFont(ofSize: 18)
        label.numberOfLines = 2
        return label
    }

    private func makeRow() -> UIStackView {
        let row = UIStackView()
        row.axis = .horizontal
        row.distribution = .fillEqually
        row.spacing = 12
        return row
    }
}
