//
//  ConciergeInteraction.swift
//  The expanded-sheet UIs for the concierge: composing a new request, and
//  voting / confirming on an existing shortlist.
//

import UIKit
import Messages

// MARK: - Composer: type an intent, the agent proposes

protocol ConciergeComposerDelegate: AnyObject {
    func composer(_ c: ConciergeComposerController, produced state: ConciergeState)
}

final class ConciergeComposerController: UIViewController, UITextFieldDelegate {

    weak var delegate: ConciergeComposerDelegate?

    private let field = UITextField()
    private let button = UIButton(configuration: .filled())
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let status = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let title = UILabel()
        title.text = "🧭 Ask the concierge"
        title.font = .boldSystemFont(ofSize: 20)

        field.placeholder = "Airbnb in Lisbon, 2 nights, under €150, walkable"
        field.borderStyle = .roundedRect
        field.returnKeyType = .send
        field.delegate = self

        var config = button.configuration
        config?.title = "Ask"
        button.configuration = config
        button.addAction(UIAction { [weak self] _ in self?.submit() }, for: .touchUpInside)

        status.font = .systemFont(ofSize: 13)
        status.textColor = .secondaryLabel
        status.numberOfLines = 2

        let stack = UIStackView(arrangedSubviews: [title, field, button, spinner, status])
        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
        ])
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool { submit(); return true }

    private func submit() {
        let intent = field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !intent.isEmpty else { return }
        field.resignFirstResponder()
        setLoading(true)
        status.text = "Thinking… the agent is researching options."

        Task {
            do {
                let state = try await ConciergeClient.ask(intent: intent)
                await MainActor.run {
                    self.setLoading(false)
                    self.delegate?.composer(self, produced: state)
                }
            } catch {
                await MainActor.run {
                    self.setLoading(false)
                    self.status.text = "Couldn't reach the concierge backend.\nStart concierge/server.py and set ConciergeClient.baseURL."
                }
            }
        }
    }

    private func setLoading(_ loading: Bool) {
        button.isEnabled = !loading
        loading ? spinner.startAnimating() : spinner.stopAnimating()
    }
}

// MARK: - Detail: vote and confirm on a shortlist

final class ConciergeDetailController: UIViewController {

    private let state: ConciergeState
    private let session: MSSession?
    private let onVote: (ConciergeState, MSSession?) -> Void
    private let onConfirm: (ConciergeState, MSSession?) -> Void

    init(state: ConciergeState,
         session: MSSession?,
         onVote: @escaping (ConciergeState, MSSession?) -> Void,
         onConfirm: @escaping (ConciergeState, MSSession?) -> Void) {
        self.state = state
        self.session = session
        self.onVote = onVote
        self.onConfirm = onConfirm
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let title = UILabel()
        title.text = "🧭 " + state.message
        title.font = .boldSystemFont(ofSize: 18)
        title.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [title])
        stack.axis = .vertical
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false

        for p in state.proposals {
            stack.addArrangedSubview(card(for: p))
        }

        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
        ])
    }

    private func card(for p: Proposal) -> UIView {
        let name = UILabel()
        name.text = p.title
        name.font = .boldSystemFont(ofSize: 16)

        let sub = UILabel()
        sub.text = "\(p.subtitle) · \(p.price)  ·  ▲ \(state.votes[p.id] ?? 0)"
        sub.font = .systemFont(ofSize: 13)
        sub.textColor = .secondaryLabel
        sub.numberOfLines = 2

        let vote = UIButton(configuration: .gray())
        vote.setTitle("Vote ▲", for: .normal)
        vote.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            self.onVote(self.state.voting(for: p.id), self.session)
        }, for: .touchUpInside)

        let confirm = UIButton(configuration: .filled())
        confirm.setTitle("Confirm", for: .normal)
        confirm.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            self.onConfirm(self.state.confirming(p.id), self.session)
        }, for: .touchUpInside)

        let buttons = UIStackView(arrangedSubviews: [vote, confirm])
        buttons.axis = .horizontal
        buttons.spacing = 10
        buttons.distribution = .fillEqually

        let card = UIStackView(arrangedSubviews: [name, sub, buttons])
        card.axis = .vertical
        card.spacing = 6
        card.isLayoutMarginsRelativeArrangement = true
        card.layoutMargins = UIEdgeInsets(top: 10, left: 12, bottom: 10, right: 12)
        card.backgroundColor = .secondarySystemBackground
        card.layer.cornerRadius = 14
        return card
    }
}
