//
//  ConciergeClient.swift
//  Thin HTTPS client from the iMessage extension to your concierge backend.
//
//  The extension never holds an API key or runs the model — it POSTs the
//  group's intent to your server (concierge/server.py), which runs the Claude
//  agent and returns the shortlist. Point BASE_URL at your deployed server.
//

import Foundation

enum ConciergeClient {

    /// Your backend. For local dev with the simulator, a Mac-local server is
    /// reachable at http://localhost:8000. In production use your HTTPS host.
    static let baseURL = URL(string: "http://localhost:8000")!

    struct Request: Encodable {
        let intent: String
        let participants: [String]
        let votes: [String: Int]?
    }

    /// Ask the agent for a shortlist. Returns a ready-to-send ConciergeState.
    static func ask(intent: String,
                    participants: [String] = ["Me", "Friend"],
                    votes: [String: Int]? = nil) async throws -> ConciergeState {
        var req = URLRequest(url: baseURL.appendingPathComponent("concierge"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(
            Request(intent: intent, participants: participants, votes: votes)
        )

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw NSError(domain: "Concierge", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Backend unavailable"])
        }

        // The backend returns {message, proposals, needs_confirmation}; decode it
        // into a fresh ConciergeState (votes start empty on the client).
        struct Reply: Decodable {
            let message: String
            let proposals: [Proposal]
            let needs_confirmation: Bool
        }
        let reply = try JSONDecoder().decode(Reply.self, from: data)
        return ConciergeState(message: reply.message,
                              proposals: reply.proposals,
                              needsConfirmation: reply.needs_confirmation)
    }
}
