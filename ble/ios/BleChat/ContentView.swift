import SwiftUI

struct ContentView: View {
    @ObservedObject private var store = BleStore.shared

    var body: some View {
        if store.loggedIn {
            MainView(store: store)
        } else {
            OnboardingView(store: store)
        }
    }
}

/// Home screen once logged in: who you are, who's nearby, your matches, and a log.
struct MainView: View {
    @ObservedObject var store: BleStore

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let me = store.me, let username = me.username {
                        Text("\(me.name ?? "") @\(username)").font(.headline)
                    } else {
                        Text("Loading your profile…").font(.headline)
                    }
                    Text(statusText).font(.caption).foregroundStyle(statusIsError ? Color.red : Color.secondary)
                    if store.me?.profile_status == "error" {
                        Button("Log in again") { store.logout() }
                    }
                }

                Section("Nearby") {
                    if store.peers.isEmpty { Text("Nobody yet…").foregroundStyle(.secondary) }
                    ForEach(store.peers) { peer in
                        HStack {
                            Text("@\(peer.username)")
                            Spacer()
                            Text("\(peer.rssi) dBm").monospacedDigit().foregroundStyle(.secondary)
                        }
                    }
                }

                Section("Matches") {
                    if matches.isEmpty { Text("No one scored yet").foregroundStyle(.secondary) }
                    ForEach(matches, id: \.other_username) { m in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(displayName(m)).fontWeight(m.matched ? .bold : .regular)
                                Spacer()
                                Text(percent(m.score)).monospacedDigit()
                            }
                            Text(m.verdict).font(.caption).foregroundStyle(.secondary)
                            Text(matchState(m)).font(.caption).foregroundStyle(m.notify_error == nil ? Color.secondary : Color.red)
                        }
                    }
                }

                Section("Log") {
                    ForEach(Array(store.log.enumerated()), id: \.offset) { _, line in
                        Text(line).font(.caption.monospaced())
                    }
                }

                Section {
                    Button("Log out", role: .destructive) { store.logout() }
                }
            }
            .navigationTitle("Harmony")
        }
    }

    private var matches: [Api.Match] { store.me?.matches ?? [] }

    private var statusText: String {
        if let error = store.serverError { return "Server: \(error)" }
        guard let me = store.me else { return "" }
        switch me.profile_status {
        case "pending": return "Muse is reading your Instagram and saving your taste profile. This can take a few minutes…"
        case "error": return "Muse failed: \(me.profile_error ?? "unknown error")"
        default: break
        }
        if me.done { return "Your match was texted. Reporting is paused (LOOP is off)." }
        if let error = me.refresh_error { return "Daily summary refresh failed: \(error)" }
        return "Sharing your username over Bluetooth · match threshold \(Int(me.match_threshold * 100))%"
    }

    private var statusIsError: Bool {
        store.serverError != nil || store.me?.profile_status == "error" || store.me?.refresh_error != nil
    }

    private func displayName(_ m: Api.Match) -> String {
        let name = m.other_name.map { "\($0) " } ?? ""
        return "\(name)@\(m.other_username)"
    }

    private func percent(_ score: Double) -> String { "\(Int(score * 100))%" }

    private func matchState(_ m: Api.Match) -> String {
        if m.notified_at != nil { return "texted" }
        if let error = m.notify_error { return "text failed: \(error)" }
        return m.matched ? "match" : "not a match"
    }
}
