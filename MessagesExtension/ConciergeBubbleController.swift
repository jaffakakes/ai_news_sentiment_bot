//
//  ConciergeBubbleController.swift
//  The agentic concierge bubble as it appears in the conversation transcript.
//
//  Renders the agent's shortlist with each option's vote count, plus a tap
//  affordance. Tapping asks to expand so the user can cast a vote or confirm —
//  which re-inserts the message on the same MSSession so the bubble updates in
//  place for both people (the live-poll mechanic, now driving a real decision).
//

import UIKit
import Messages

final class ConciergeBubbleController: UIViewController {

    private let state: ConciergeState
    private let onTap: () -> Void

    init(state: ConciergeState, onTap: @escaping () -> Void) {
        self.state = state
        self.onTap = onTap
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        let header = UILabel()
        header.text = (state.confirmedID != nil ? "✅ Booked · " : "🧭 ") + state.message
        header.font = .boldSystemFont(ofSize: 15)
        header.textColor = .label
        header.numberOfLines = 2

        let stack = UIStackView(arrangedSubviews: [header])
        stack.axis = .vertical
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false

        // One row per proposal: title/subtitle + vote count (✓ if confirmed).
        for p in state.proposals {
            stack.addArrangedSubview(row(for: p))
        }

        let hint = UILabel()
        hint.text = state.confirmedID != nil ? "Confirmed" : "Tap to vote or confirm ›"
        hint.font = .systemFont(ofSize: 12, weight: .medium)
        hint.textColor = .tertiaryLabel
        stack.addArrangedSubview(hint)

        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 10),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -10),
        ])

        view.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapped)))
    }

    private func row(for p: Proposal) -> UIView {
        let confirmed = state.confirmedID == p.id
        let count = state.votes[p.id] ?? 0

        let title = UILabel()
        title.text = (confirmed ? "✓ " : "") + p.title
        title.font = .systemFont(ofSize: 14, weight: confirmed ? .bold : .semibold)
        title.textColor = .label

        let sub = UILabel()
        sub.text = "\(p.subtitle) · \(p.price)"
        sub.font = .systemFont(ofSize: 12)
        sub.textColor = .secondaryLabel
        sub.numberOfLines = 1

        let text = UIStackView(arrangedSubviews: [title, sub])
        text.axis = .vertical
        text.spacing = 1

        let badge = UILabel()
        badge.text = count > 0 ? "▲ \(count)" : "▲"
        badge.font = .systemFont(ofSize: 13, weight: .semibold)
        badge.textColor = count > 0 ? .systemBlue : .tertiaryLabel
        badge.setContentHuggingPriority(.required, for: .horizontal)

        let row = UIStackView(arrangedSubviews: [text, badge])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 8
        return row
    }

    @objc private func tapped() { onTap() }
}
