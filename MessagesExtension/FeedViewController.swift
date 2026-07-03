//
//  FeedViewController.swift
//  The TikTok-style vertical, swipeable, autoplaying feed.
//
//  Shown in the extension's EXPANDED presentation (the big sheet over the
//  keyboard). A full-screen vertical paging collection view: one video per
//  page, the visible one plays, the rest are paused. Swipe up/down to move
//  through clips. Tap the paper-plane to send a clip into the chat.
//

import UIKit

final class FeedViewController: UIViewController, UICollectionViewDataSource, UICollectionViewDelegate {

    private let items: [FeedItem]
    private let startIndex: Int
    private var collectionView: UICollectionView!
    private var currentIndex: Int = 0

    /// Called when the user taps send on a clip — the host stages it as a bubble.
    var onSend: ((FeedItem) -> Void)?

    init(items: [FeedItem] = FeedItem.catalog, startAt index: Int = 0) {
        self.items = items
        self.startIndex = index
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .vertical
        layout.minimumLineSpacing = 0
        layout.minimumInteritemSpacing = 0

        collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.isPagingEnabled = true
        collectionView.showsVerticalScrollIndicator = false
        collectionView.contentInsetAdjustmentBehavior = .never
        collectionView.backgroundColor = .black
        collectionView.dataSource = self
        collectionView.delegate = self
        collectionView.register(VideoCell.self, forCellWithReuseIdentifier: VideoCell.reuseID)

        collectionView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(collectionView)
        NSLayoutConstraint.activate([
            collectionView.topAnchor.constraint(equalTo: view.topAnchor),
            collectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Each page fills the screen.
        if let layout = collectionView.collectionViewLayout as? UICollectionViewFlowLayout,
           layout.itemSize != collectionView.bounds.size,
           collectionView.bounds.size != .zero {
            layout.itemSize = collectionView.bounds.size
            layout.invalidateLayout()
            // Jump to the requested starting clip once we have a real size.
            scrollTo(index: startIndex, animated: false)
        }
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        // Stop audio/video when the sheet closes.
        visibleCell?.pause()
    }

    // MARK: Data source

    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        items.count
    }

    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: VideoCell.reuseID, for: indexPath) as! VideoCell
        cell.configure(with: items[indexPath.item])
        cell.onSend = { [weak self] item in self?.onSend?(item) }
        return cell
    }

    // MARK: Playback follows the visible page

    func collectionView(_ collectionView: UICollectionView, willDisplay cell: UICollectionViewCell, forItemAt indexPath: IndexPath) {
        if indexPath.item == currentIndex { (cell as? VideoCell)?.play() }
    }

    func collectionView(_ collectionView: UICollectionView, didEndDisplaying cell: UICollectionViewCell, forItemAt indexPath: IndexPath) {
        (cell as? VideoCell)?.teardown()
    }

    func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
        updateVisiblePlayback()
    }

    func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) {
        updateVisiblePlayback()
    }

    private func updateVisiblePlayback() {
        let page = Int(round(collectionView.contentOffset.y / max(collectionView.bounds.height, 1)))
        guard page != currentIndex else { return }
        // Pause the old, play the new.
        (collectionView.cellForItem(at: IndexPath(item: currentIndex, section: 0)) as? VideoCell)?.pause()
        currentIndex = page
        visibleCell?.play()
    }

    private var visibleCell: VideoCell? {
        collectionView.cellForItem(at: IndexPath(item: currentIndex, section: 0)) as? VideoCell
    }

    private func scrollTo(index: Int, animated: Bool) {
        guard index >= 0, index < items.count else { return }
        currentIndex = index
        collectionView.scrollToItem(at: IndexPath(item: index, section: 0), at: .centeredVertically, animated: animated)
        // Ensure the landed cell plays even without a scroll event.
        DispatchQueue.main.async { [weak self] in self?.visibleCell?.play() }
    }
}
