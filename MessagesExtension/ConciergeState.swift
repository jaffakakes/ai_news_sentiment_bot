//
//  ConciergeState.swift
//  The shared state of an agentic "concierge" bubble — the agent's shortlist
//  plus everyone's votes — serialized into the message so both people see and
//  steer the same decision.
//
//  This is the client mirror of the backend contract (concierge/agent.py →
//  ConciergeReply). The agent runs on your server; its shortlist rides into the
//  thread inside message.url, and votes sync back the same way (via MSSession),
//  exactly like the vibe and video bubbles.
//

import Messages

struct Proposal: Codable, Equatable {
    let id: String
    let title: String
    let subtitle: String
    let price: String
    var highlights: [String] = []
}

struct ConciergeState: Codable {

    var message: String                 // the agent's one-line recommendation
    var proposals: [Proposal]
    var needsConfirmation: Bool
    var votes: [String: Int] = [:]      // proposal id -> vote count
    var confirmedID: String? = nil      // set once a human confirms a pick

    // MARK: Encode → message.url

    var url: URL {
        var components = URLComponents()
        components.scheme = "vibecheck"
        components.host = "concierge"
        let data = (try? JSONEncoder().encode(self)) ?? Data()
        components.queryItems = [
            URLQueryItem(name: "data", value: data.base64EncodedString())
        ]
        return components.url!
    }

    // MARK: Decode ← message.url

    init?(url: URL?) {
        guard
            let url = url,
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            components.host == "concierge",
            let b64 = components.queryItems?.first(where: { $0.name == "data" })?.value,
            let data = Data(base64Encoded: b64),
            let decoded = try? JSONDecoder().decode(ConciergeState.self, from: data)
        else { return nil }
        self = decoded
    }

    init(message: String, proposals: [Proposal], needsConfirmation: Bool) {
        self.message = message
        self.proposals = proposals
        self.needsConfirmation = needsConfirmation
    }

    // MARK: Mutation

    func voting(for id: String) -> ConciergeState {
        var next = self
        next.votes[id, default: 0] += 1
        return next
    }

    func confirming(_ id: String) -> ConciergeState {
        var next = self
        next.confirmedID = id
        return next
    }

    var topPick: Proposal? {
        proposals.max { (votes[$0.id] ?? 0) < (votes[$1.id] ?? 0) } ?? proposals.first
    }

    // MARK: Build the MSMessage

    func makeMessage(session: MSSession? = nil) -> MSMessage {
        let msg = MSMessage(session: session ?? MSSession())
        msg.url = url

        let template = MSMessageTemplateLayout()
        template.image = FallbackRenderer.conciergePoster(for: self)
        template.caption = confirmedID != nil ? "✅ Booked" : "🧭 Concierge"
        template.subcaption = message
        template.imageTitle = confirmedID != nil ? nil : "Tap to vote"
        msg.layout = MSMessageLiveLayout(alternateLayout: template)
        msg.summaryText = "🧭 \(message)"
        return msg
    }
}
