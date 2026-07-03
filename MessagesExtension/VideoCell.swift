//
//  VideoCell.swift
//  One full-screen page in the vertical feed — a single looping video with
//  the TikTok-style overlay (author, caption, like + mute buttons, send).
//
//  Each cell owns its own AVPlayer. The feed tells exactly one cell to play at
//  a time (the one on screen) and pauses the rest, so we never stream five
//  videos at once.
//

import UIKit
import AVFoundation

final class VideoCell: UICollectionViewCell {

    static let reuseID = "VideoCell"

    private let playerLayer = AVPlayerLayer()
    private var player: AVPlayer?
    private var looper: Any?              // retains the loop observer
    private var item: FeedItem?

    private var localLikes = 0
    private var liked = false

    // Overlay
    private let authorLabel = UILabel()
    private let captionLabel = UILabel()
    private let likeButton = UIButton(type: .system)
    private let muteButton = UIButton(type: .system)
    private let sendButton = UIButton(type: .system)
    private let playIcon = UIImageView()

    /// Called when the user taps "send this clip".
    var onSend: ((FeedItem) -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        contentView.backgroundColor = .black
        playerLayer.videoGravity = .resizeAspectFill
        contentView.layer.addSublayer(playerLayer)
        setupOverlay()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        playerLayer.frame = contentView.bounds
    }

    // MARK: Overlay UI

    private func setupOverlay() {
        // Tap anywhere toggles play/pause.
        contentView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(togglePlayPause)))

        playIcon.image = UIImage(systemName: "play.fill")
        playIcon.tintColor = UIColor.white.withAlphaComponent(0.85)
        playIcon.contentMode = .scaleAspectFit
        playIcon.isHidden = true
        playIcon.translatesAutoresizingMaskIntoConstraints = false

        authorLabel.font = .boldSystemFont(ofSize: 18)
        authorLabel.textColor = .white

        captionLabel.font = .systemFont(ofSize: 15)
        captionLabel.textColor = .white
        captionLabel.numberOfLines = 3

        let textStack = UIStackView(arrangedSubviews: [authorLabel, captionLabel])
        textStack.axis = .vertical
        textStack.spacing = 6
        textStack.translatesAutoresizingMaskIntoConstraints = false

        configureIcon(likeButton, systemName: "heart.fill", action: #selector(toggleLike))
        configureIcon(muteButton, systemName: "speaker.slash.fill", action: #selector(toggleMute))
        configureIcon(sendButton, systemName: "paperplane.fill", action: #selector(sendTapped))

        let buttonStack = UIStackView(arrangedSubviews: [likeButton, muteButton, sendButton])
        buttonStack.axis = .vertical
        buttonStack.spacing = 22
        buttonStack.alignment = .center
        buttonStack.translatesAutoresizingMaskIntoConstraints = false

        // Subtle gradient scrim so white text stays readable over any video.
        let scrim = GradientScrimView()
        scrim.translatesAutoresizingMaskIntoConstraints = false

        contentView.addSubview(scrim)
        contentView.addSubview(playIcon)
        contentView.addSubview(textStack)
        contentView.addSubview(buttonStack)

        NSLayoutConstraint.activate([
            scrim.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            scrim.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            scrim.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            scrim.heightAnchor.constraint(equalTo: contentView.heightAnchor, multiplier: 0.45),

            playIcon.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            playIcon.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            playIcon.widthAnchor.constraint(equalToConstant: 64),
            playIcon.heightAnchor.constraint(equalToConstant: 64),

            textStack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            textStack.trailingAnchor.constraint(equalTo: buttonStack.leadingAnchor, constant: -16),
            textStack.bottomAnchor.constraint(equalTo: contentView.safeAreaLayoutGuide.bottomAnchor, constant: -20),

            buttonStack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            buttonStack.bottomAnchor.constraint(equalTo: contentView.safeAreaLayoutGuide.bottomAnchor, constant: -20),
        ])
    }

    private func configureIcon(_ button: UIButton, systemName: String, action: Selector) {
        button.setImage(UIImage(systemName: systemName), for: .normal)
        button.tintColor = .white
        button.setPreferredSymbolConfiguration(.init(pointSize: 30), forImageIn: .normal)
        button.addTarget(self, action: action, for: .touchUpInside)
    }

    // MARK: Configuration & playback

    func configure(with item: FeedItem) {
        self.item = item
        authorLabel.text = item.author
        captionLabel.text = item.caption
        localLikes = item.likes
        liked = false
        updateLikeLabel()

        // Fresh player for this item; loop it forever.
        let player = AVPlayer(url: item.videoURL)
        player.isMuted = true            // autoplay policy: start muted
        playerLayer.player = player
        self.player = player

        looper = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: player.currentItem,
            queue: .main
        ) { [weak player] _ in
            player?.seek(to: .zero)
            player?.play()
        }
        updateMuteIcon()
    }

    func play() {
        player?.play()
        playIcon.isHidden = true
    }

    func pause() {
        player?.pause()
    }

    /// Fully tear down when the cell scrolls away / is reused.
    func teardown() {
        player?.pause()
        if let looper { NotificationCenter.default.removeObserver(looper) }
        looper = nil
        playerLayer.player = nil
        player = nil
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        teardown()
    }

    // MARK: Actions

    @objc private func togglePlayPause() {
        guard let player else { return }
        if player.timeControlStatus == .playing {
            player.pause()
            playIcon.isHidden = false
        } else {
            player.play()
            playIcon.isHidden = true
        }
    }

    @objc private func toggleLike() {
        liked.toggle()
        localLikes += liked ? 1 : -1
        updateLikeLabel()
        // Little pop.
        UIView.animate(withDuration: 0.12, animations: { self.likeButton.transform = .init(scaleX: 1.3, y: 1.3) }) { _ in
            UIView.animate(withDuration: 0.12) { self.likeButton.transform = .identity }
        }
    }

    @objc private func toggleMute() {
        guard let player else { return }
        player.isMuted.toggle()
        updateMuteIcon()
    }

    @objc private func sendTapped() {
        guard let item else { return }
        onSend?(item)
    }

    private func updateLikeLabel() {
        likeButton.tintColor = liked ? .systemPink : .white
    }

    private func updateMuteIcon() {
        let muted = player?.isMuted ?? true
        muteButton.setImage(UIImage(systemName: muted ? "speaker.slash.fill" : "speaker.wave.2.fill"), for: .normal)
    }
}

/// A bottom-up dark gradient so overlay text is readable over bright video.
final class GradientScrimView: UIView {
    override class var layerClass: AnyClass { CAGradientLayer.self }
    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        let gradient = layer as! CAGradientLayer
        gradient.colors = [UIColor.clear.cgColor, UIColor.black.withAlphaComponent(0.6).cgColor]
        gradient.locations = [0, 1]
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}
