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

    /// Set when the user taps "Watch Feed" from the picker (no bubble selected).
    private var wantsFeed = false

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
            controller = transcriptController(for: conversation)
        } else if presentationStyle == .expanded, let feed = feedControllerIfNeeded(for: conversation) {
            controller = feed
        } else {
            controller = composeOrReactController(for: conversation)
        }

        swap(to: controller)
    }

    /// A bubble rendered inline in the chat. Could be a vibe or a video preview.
    private func transcriptController(for conversation: MSConversation) -> UIViewController {
        let url = conversation.selectedMessage?.url

        if let video = VideoState(url: url) {
            return VideoBubbleController(state: video) { [weak self] in
                // Tap → expand into the full feed at this clip.
                self?.requestPresentationStyle(.expanded)
            }
        }

        let vibe = VibeState(url: url) ?? VibeState(vibeID: "hype", caption: "Vibe")
        return BubbleViewController(state: vibe) { [weak self] in
            self?.requestPresentationStyle(.expanded)
        }
    }

    /// The TikTok-style feed — shown when a video bubble was tapped, or when the
    /// user asked for it. Returns nil when the feed isn't what's wanted.
    private func feedControllerIfNeeded(for conversation: MSConversation) -> UIViewController? {
        var startIndex: Int?
        if let video = VideoState(url: conversation.selectedMessage?.url) {
            startIndex = video.item.index          // opened by tapping a video bubble
        } else if wantsFeed {
            startIndex = 0                          // opened via "Watch Feed"
        }
        guard let index = startIndex else { return nil }

        let feed = FeedViewController(startAt: index)
        feed.onSend = { [weak self] item in
            guard let self, let conversation = self.activeConversation else { return }
            conversation.insert(VideoState(item: item).makeMessage()) { error in
                if let error { NSLog("Video insert failed: \(error)") }
            }
            self.wantsFeed = false
            self.requestPresentationStyle(.compact)
        }
        return feed
    }

    /// The compose grid, or the reaction picker if a vibe bubble is selected.
    private func composeOrReactController(for conversation: MSConversation) -> UIViewController {
        let picker = PickerViewController()
        picker.delegate = self
        if let selected = conversation.selectedMessage,
           let state = VibeState(url: selected.url) {
            picker.reactingTo = (state: state, session: selected.session)
        }
        return picker
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

    /// User tapped "Watch Feed" — expand into the swipeable video feed.
    func pickerDidRequestFeed(_ picker: PickerViewController) {
        wantsFeed = true
        requestPresentationStyle(.expanded)
    }
}
