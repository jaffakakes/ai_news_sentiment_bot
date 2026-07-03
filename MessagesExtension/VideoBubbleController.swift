//
//  VideoBubbleController.swift
//  The little preview bubble for a shared video, shown in the chat transcript.
//
//  Deliberately lightweight (no live video here — the transcript must stay
//  snappy): a poster with a play glyph, the author, and the caption. Tapping
//  asks to expand into the full swipeable feed at this clip.
//

import UIKit

final class VideoBubbleController: UIViewController {

    private let state: VideoState
    private let onWatch: () -> Void

    init(state: VideoState, onWatch: @escaping () -> Void) {
        self.state = state
        self.onWatch = onWatch
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()

        let poster = UIImageView(image: FallbackRenderer.videoPoster(for: state.item))
        poster.contentMode = .scaleAspectFill
        poster.clipsToBounds = true
        poster.layer.cornerRadius = 16
        poster.translatesAutoresizingMaskIntoConstraints = false

        let author = UILabel()
        author.text = state.item.author
        author.font = .boldSystemFont(ofSize: 15)
        author.textColor = .label

        let caption = UILabel()
        caption.text = state.caption
        caption.font = .systemFont(ofSize: 14)
        caption.textColor = .secondaryLabel
        caption.numberOfLines = 2

        let hint = UILabel()
        hint.text = "▶ Tap to watch"
        hint.font = .systemFont(ofSize: 12, weight: .medium)
        hint.textColor = .tertiaryLabel

        let textStack = UIStackView(arrangedSubviews: [author, caption, hint])
        textStack.axis = .vertical
        textStack.spacing = 2
        textStack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(poster)
        view.addSubview(textStack)

        NSLayoutConstraint.activate([
            poster.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),
            poster.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
            poster.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),
            poster.heightAnchor.constraint(equalToConstant: 130),

            textStack.topAnchor.constraint(equalTo: poster.bottomAnchor, constant: 8),
            textStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            textStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            textStack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -8),
        ])

        view.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(watch)))
    }

    @objc private func watch() { onWatch() }
}
