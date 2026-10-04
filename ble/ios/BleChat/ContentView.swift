import SwiftUI

struct ContentView: View {
    @ObservedObject private var store = BleStore.shared

    var body: some View {
        Group {
            if store.loggedIn {
                MainView(store: store)
            } else {
                OnboardingView(store: store)
            }
        }
        .animation(.easeInOut, value: store.loggedIn)
    }
}

/// Home once signed in: your profile, people nearby, matches; plus the log in developer mode.
struct MainView: View {
    @ObservedObject var store: BleStore
    @AppStorage("dev_mode") private var devMode = false
    @State private var composing = false
    @State private var textsPending: Bool?
    @State private var textsError: String?
    @State private var composeLine: String?

    private static let firstText = "Hi Harmonize! Turning on my match texts."

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    profileCard
                    notices
                    if store.me?.profile_status == "ready" {
                        nearby
                        matchesSection
                    }
                    if devMode { developer }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
            .background(Color(.systemGroupedBackground))
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $composing) {
                if let line = composeLine {
                    MessageComposer(recipient: line, body: Self.firstText) { sent in
                        if sent { markFirstText(line) }
                    }
                    .ignoresSafeArea()
                }
            }
        }
        .tint(Brand.violet)
    }

    // MARK: Sections

    private var header: some View {
        HStack(spacing: 8) {
            Logo(size: 32)
            Text("Harmonize").font(.title2.weight(.semibold))
            Spacer()
            Menu {
                Toggle("Developer mode", isOn: $devMode)
                Button("Sign out", role: .destructive) { store.logout() }
            } label: {
                Image(systemName: "ellipsis.circle").font(.title2)
            }
        }
        .padding(.top, 4)
        .padding(.bottom, 8)
    }

    private var profileCard: some View {
        let me = store.me
        return VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 14) {
                Text(String((me?.name ?? me?.username ?? "?").prefix(1)).uppercased())
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 56, height: 56)
                    .background(.white.opacity(0.22), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(me?.name ?? (me == nil ? "Loading…" : "Setting up"))
                        .font(.title3.weight(.semibold)).foregroundStyle(.white).lineLimit(1)
                    if let username = me?.username {
                        Text("@\(username)").font(.subheadline).foregroundStyle(.white.opacity(0.85))
                    }
                }
            }
            HStack(spacing: 8) {
                if me?.profile_status == "ready" && store.bluetoothOn && me?.done != true { LiveDot() }
                Text(statusLine).font(.caption.weight(.medium)).foregroundStyle(.white)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(.white.opacity(0.18), in: Capsule())
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.gradient, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .padding(.top, 8)
    }

    private var statusLine: String {
        guard let me = store.me else { return "Getting your profile ready" }
        switch me.profile_status {
        case "error": return "Needs attention"
        case "ready":
            if me.done { return "Matched, paused" }
            return store.bluetoothOn ? "Looking for people nearby" : "Bluetooth is off"
        default: return "Getting your profile ready"
        }
    }

    @ViewBuilder
    private var notices: some View {
        if let error = store.serverError {
            MessageCard(text: devMode ? "Server: \(error)" : Friendly.error(error), isError: true, mono: devMode).padding(.top, 16)
        }
        if let me = store.me {
            switch me.profile_status {
            case "pending":
                CardBox {
                    HStack(spacing: 16) {
                        ProgressView().controlSize(.large).tint(Brand.violet)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Muse is reading your Instagram").font(.headline)
                            Text("This takes a few minutes. You can leave the app; we'll start finding people as soon as it's done.")
                                .font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(.top, 16)
            case "error":
                MessageCard(text: devMode ? (me.profile_error ?? "") : Friendly.profileError(me.profile_error), isError: true, mono: devMode)
                    .padding(.top, 16)
                GradientButton(title: "Sign in again", busy: false) { store.logout() }.padding(.top, 12)
            default:
                matchTextsCard(me)
                if me.done {
                    MessageCard(text: "You've been matched! We texted you both, so go say hi.", isError: false).padding(.top, 16)
                }
                if devMode, let refresh = me.refresh_error {
                    MessageCard(text: "Daily refresh failed: \(refresh)", isError: true, mono: true).padding(.top, 16)
                }
            }
        }
    }

    private var nearby: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionTitle("Nearby", trailing: store.peers.isEmpty ? nil : "\(store.peers.count)")
            if store.peers.isEmpty {
                emptyCard("No one nearby yet", "Keep Harmonize running. We'll find people around you who are on Harmonize too.")
            } else {
                CardBox {
                    ForEach(Array(store.peers.enumerated()), id: \.element.id) { index, peer in
                        if index > 0 { Divider().padding(.vertical, 12) }
                        HStack(spacing: 12) {
                            Avatar(name: peer.username, size: 40)
                            Text("@\(peer.username)").font(.body)
                            Spacer()
                            SignalBars(rssi: peer.rssi)
                        }
                    }
                }
            }
        }
    }

    private var matchesSection: some View {
        let matches = store.me?.matches ?? []
        return VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Matches", trailing: matches.isEmpty ? nil : "\(matches.count)")
            if matches.isEmpty {
                emptyCard("No matches yet", "When someone who watches the same kind of reels is nearby, they'll show up here.")
            }
            ForEach(matches, id: \.other_username) { match in
                MatchCard(match: match)
            }
        }
    }

    private var developer: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionTitle("Developer", trailing: nil)
            CardBox {
                devLine("Server", Api.serverUrl)
                devLine("Bluetooth", store.bluetoothOn ? "running" : "stopped")
                if let me = store.me {
                    devLine("Profile", me.profile_status)
                    devLine("Match threshold", "\(Int(me.match_threshold * 100))%")
                    devLine("LOOP", me.loop ? "true" : "false")
                    devLine("Photon line", me.photon_line ?? "none")
                    devLine("First text", me.first_text_at != nil ? "sent" : "not sent")
                }
            }
            if let summary = store.me?.summary {
                sectionTitle("Your Instagram summary", trailing: nil)
                CardBox {
                    Text(summary).font(.subheadline)
                    Text(summaryCaption)
                        .font(.caption).foregroundStyle(.secondary).padding(.top, 8)
                }
            }
            sectionTitle("Log", trailing: nil)
            CardBox {
                if store.log.isEmpty { Text("Nothing yet").foregroundStyle(.secondary) }
                ForEach(Array(store.log.enumerated()), id: \.offset) { _, line in
                    Text(line).font(.caption2.monospaced()).padding(.vertical, 3)
                }
            }
        }
    }

    // MARK: Match texts
    // On Photon's shared lines a person must text their line once before Photon
    // may text them. iOS only allows that with the person tapping Send, so turning
    // the switch on opens a pre-filled message; sending it triggers the server's
    // "match texts are on" confirmation text.

    private func matchTextsCard(_ me: Api.Me) -> some View {
        let on = textsPending ?? me.consent
        let status: String
        if let pending = textsPending {
            status = pending ? "Turning on…" : "Turning off…"
        } else if !me.consent {
            status = "Get a text when someone you match with is nearby."
        } else if me.texts_confirmed_at != nil {
            status = "On. We'll text \(me.phone_number)."
        } else {
            status = "Setting up… you'll get a confirmation text shortly."
        }
        let error = textsError ?? (me.consent ? me.photon_error : nil)
        return CardBox {
            Toggle(isOn: Binding(get: { on }, set: { setTexts($0) })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Match texts").font(.headline)
                    Text(status).font(.subheadline).foregroundStyle(.secondary)
                }
            }
            .tint(Brand.violet)
            .disabled(textsPending != nil)
            if me.consent, let line = me.photon_line, !Api.firstTextSent(line) {
                GradientButton(title: "Send the setup text", busy: false) { openFirstText(line) }.padding(.top, 14)
            }
            if let error {
                MessageCard(text: devMode ? error : "We couldn't turn on match texts. Try switching them off and on again.", isError: true, mono: devMode)
                    .padding(.top, 12)
            }
        }
        .padding(.top, 16)
    }

    private func setTexts(_ enabled: Bool) {
        textsPending = enabled
        textsError = nil
        Task {
            do {
                let line = try await Api.setTexts(enabled)
                textsPending = nil
                if enabled, let line {
                    // Already texted this line before: just report it, which sends the confirmation text.
                    if Api.firstTextSent(line) { markFirstText(line) } else { openFirstText(line) }
                }
            } catch {
                textsPending = nil
                textsError = error.localizedDescription
            }
            await store.refresh()
        }
    }

    private func openFirstText(_ line: String) {
        if MessageComposer.canSend {
            composeLine = line
            composing = true
        } else if let url = URL(string: "sms:\(line)&body=\(Self.firstText.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
            UIApplication.shared.open(url)
            markFirstText(line)
        }
    }

    private func markFirstText(_ line: String) {
        Api.markFirstTextSent(line)
        Task {
            do { try await Api.reportFirstText(line: line) } catch { store.onLog("Reporting the first text failed: \(error.localizedDescription)") }
            await store.refresh()
        }
    }

    private var summaryCaption: String {
        var caption = "Written by Muse"
        if let ms = store.me?.summarized_at {
            let date = Date(timeIntervalSince1970: ms / 1000)
            caption += ", updated " + date.formatted(date: .abbreviated, time: .shortened)
        }
        return caption + ". This is what your matches are scored on."
    }

    // MARK: Pieces

    private func sectionTitle(_ title: String, trailing: String?) -> some View {
        HStack(alignment: .lastTextBaseline) {
            Text(title).font(.title3.weight(.semibold))
            Spacer()
            if let trailing { Text(trailing).font(.caption.weight(.medium)).foregroundStyle(.secondary) }
        }
        .padding(.horizontal, 4)
        .padding(.top, 24)
        .padding(.bottom, 10)
    }

    private func emptyCard(_ title: String, _ body: String) -> some View {
        CardBox {
            Text(title).font(.headline)
            Text(body).font(.subheadline).foregroundStyle(.secondary).padding(.top, 4)
        }
    }

    private func devLine(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(label).font(.subheadline).foregroundStyle(.secondary).frame(width: 120, alignment: .leading)
            Text(value).font(.subheadline.monospaced())
        }
        .padding(.vertical, 3)
    }
}

private struct MatchCard: View {
    var match: Api.Match

    var body: some View {
        CardBox {
            HStack(spacing: 16) {
                ScoreRing(score: match.score, highlight: match.matched)
                VStack(alignment: .leading, spacing: 2) {
                    Text(match.other_name ?? "@\(match.other_username)").font(.headline).lineLimit(1)
                    if match.other_name != nil {
                        Text("@\(match.other_username)").font(.subheadline).foregroundStyle(.secondary)
                    }
                    Text(match.verdict).font(.subheadline).padding(.top, 4)
                }
            }
            badge.padding(.top, 12)
        }
    }

    @ViewBuilder
    private var badge: some View {
        if match.notified_at != nil {
            Pill(text: "Texted you both", tint: Brand.pink)
        } else if match.notify_error != nil {
            Pill(text: "Couldn't send the text", tint: .red)
        } else if match.matched {
            Pill(text: "It's a match", tint: Brand.violet)
        } else {
            Pill(text: "Different tastes", tint: .secondary)
        }
    }
}
