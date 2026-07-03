//
//  MessagesViewController.swift
//  The extension's entry point — the "router" for the whole app.
//
//  Messages hands us ONE MSMessagesAppViewController and reuses it for every
//  context. Our job is to look at the current presentationStyle and either:
//    • .transcript  → we're being rendered as a bubble in the chat → show the
//                     live BubbleViewController for the selected message.
//    • .compact/.expanded → the user opened our app → show the PickerViewController.
//
//  This single-router pattern is exactly how Giphy/polls/games are structured.
//

import UIKit
import Messages

final class MessagesViewController: MSMessagesAppViewController {

    private var currentChild: UIViewController?

    // MARK: Lifecycle

    override func willBecomeActive(with conversation: MSConversation) {
        super.willBecomeActive(with: conversation)
        render(for: conversation)
    }

    override func didTransition(to presentationStyle: MSMessagesAppPresentationStyle) {
        super.didTransition(to: presentationStyle)
        guard let conversation = activeConversation else { return }
        render(for: conversation)
    }

    // MARK: Routing

    private func render(for conversation: MSConversation) {
        let controller: UIViewController

        if presentationStyle == .transcript {
            // We're a bubble in the conversation. Draw from the selected message.
            let state = VibeState(url: conversation.selectedMessage?.url)
                ?? VibeState(vibeID: "hype", caption: "Vibe")
            controller = BubbleViewController(state: state) { [weak self] in
                // Tapped inside the bubble → expand so we can compose a reaction.
                self?.requestPresentationStyle(.expanded)
            }
        } else {
            // The user opened our app to compose — or to react after a bubble tap.
            let picker = PickerViewController()
            picker.delegate = self

            // If a bubble is selected, we're here to react to it, not compose fresh.
            if let selected = conversation.selectedMessage,
               let state = VibeState(url: selected.url) {
                picker.reactingTo = (state: state, session: selected.session)
            }
            controller = picker
        }

        swap(to: controller)
    }

    /// Swap the visible child view controller, cleaning up the old one.
    private func swap(to controller: UIViewController) {
        currentChild?.willMove(toParent: nil)
        currentChild?.view.removeFromSuperview()
        currentChild?.removeFromParent()

        addChild(controller)
        controller.view.frame = view.bounds
        controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(controller.view)
        controller.didMove(toParent: self)
        currentChild = controller
    }
}

// MARK: - PickerDelegate

extension MessagesViewController: PickerDelegate {

    /// Compose a brand-new bubble and stage it in the input field.
    func picker(_ picker: PickerViewController, didPick vibe: Vibe, caption: String) {
        guard let conversation = activeConversation else { return }
        let state = VibeState(vibeID: vibe.id, caption: caption)
        conversation.insert(state.makeMessage()) { error in
            if let error { NSLog("Insert failed: \(error)") }
        }
        requestPresentationStyle(.compact)
    }

    /// Apply a reaction to an existing bubble. Reusing the message's session
    /// means the bubble updates IN PLACE for both people instead of adding a
    /// new bubble — the live-poll mechanic.
    func picker(_ picker: PickerViewController, didReact reaction: Reaction, to state: VibeState, session: MSSession?) {
        guard let conversation = activeConversation else { return }
        let updated = state.adding(reaction)
        conversation.insert(updated.makeMessage(session: session)) { error in
            if let error { NSLog("Reaction insert failed: \(error)") }
        }
        requestPresentationStyle(.compact)
    }
}
