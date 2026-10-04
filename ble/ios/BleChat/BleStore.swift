import Foundation

/// Owns Bluetooth (Method 2) and everything the screens show. Once logged in it
/// polls the server for the profile and matches, starts Bluetooth with the
/// Instagram username the server reported, and reports every username read
/// over Bluetooth back to the server. Method1Advertise.swift is kept for
/// reference but no longer used.
final class BleStore: ObservableObject, BleListener {
    /// Created at launch by AppDelegate, including background relaunches with no UI,
    /// so Method 2's state restoration finds its Bluetooth managers.
    static let shared = BleStore()

    @Published private(set) var loggedIn = Api.token != nil
    @Published private(set) var me: Api.Me?
    @Published private(set) var serverError: String?
    @Published private(set) var peers: [Peer] = []
    @Published private(set) var log: [String] = []
    @Published private(set) var bluetoothOn = false

    private var peersByKey: [String: Peer] = [:]
    private lazy var method2 = Method2Gatt(listener: self)
    private var runningUsername: String?
    private var reportingStopped = false
    private var pruneTimer: Timer?
    private var refreshTimer: Timer?
    private let time: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f
    }()

    private static let peerTimeout: TimeInterval = 15
    private static let refreshEvery: TimeInterval = 15

    private init() {
        pruneTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.prune() }
        guard loggedIn else { return }
        // After a reboot, or when iOS relaunches the app in the background for
        // state restoration, Bluetooth must come back before the server answers.
        if let username = UserDefaults.standard.string(forKey: "username") { ensureBluetooth(username) }
        startRefreshing()
    }

    func login(token: String) {
        Api.token = token
        loggedIn = true
        reportingStopped = false
        startRefreshing()
    }

    func logout() {
        refreshTimer?.invalidate()
        refreshTimer = nil
        method2.stop()
        runningUsername = nil
        bluetoothOn = false
        UserDefaults.standard.removeObject(forKey: "username")
        Api.token = nil
        me = nil
        serverError = nil
        loggedIn = false
    }

    // MARK: Server

    private func startRefreshing() {
        refreshTimer?.invalidate()
        refreshTimer = Timer.scheduledTimer(withTimeInterval: Self.refreshEvery, repeats: true) { [weak self] _ in
            Task { await self?.refresh() }
        }
        Task { await refresh() }
    }

    @MainActor
    func refresh() async {
        do {
            let result = try await Api.me()
            me = result
            serverError = nil
            if result.profile_status == "ready", let username = result.username { ensureBluetooth(username) }
        } catch {
            serverError = error.localizedDescription
        }
    }

    private func ensureBluetooth(_ username: String) {
        guard runningUsername != username else { return }
        method2.stop()
        method2.start(username: username)
        runningUsername = username
        bluetoothOn = true
        UserDefaults.standard.set(username, forKey: "username")
    }

    /// Tells the server we're near `username`; the result (or error) goes to the log.
    private func report(_ username: String) async {
        guard !reportingStopped else { return }
        do {
            let r = try await Api.encounter(username)
            await MainActor.run { onLog(describe(r)) }
        } catch {
            await MainActor.run { onLog("Reporting @\(username) to the server failed: \(error.localizedDescription)") }
        }
    }

    private func describe(_ r: Api.Encounter) -> String {
        let who = "@\(r.other_username)"
        let pct = r.score.map { "\(Int($0 * 100))%" } ?? "?"
        switch r.status {
        case "done":
            reportingStopped = true
            return "Your match was already texted; reporting stopped (LOOP is off)"
        case "no_profile": return "\(who): no taste profile in the database yet"
        case "not_a_match": return "\(who): \(pct), not a match"
        case "match_waiting": return "\(who): \(pct), MATCH. Waiting for their phone to see you too"
        case "match_no_consent": return "\(who): \(pct), MATCH, but one of you turned off texts"
        case "already_notified": return "\(who): \(pct), MATCH (already texted)"
        case "notified": return "\(who): \(pct), MATCH. Texted you both"
        default: return "\(who): \(r.status)"
        }
    }

    // MARK: BleListener

    func onPeer(_ peer: Peer) {
        peersByKey[peer.key] = peer
        publishPeers()
    }

    func onMessage(from: String, text: String) {
        onLog("MESSAGE from \(from): \(text)")
    }

    func onLog(_ line: String) {
        print("Harmonize: \(line)") // shows in Xcode's console
        log.insert("\(time.string(from: Date()))  \(line)", at: 0)
        if log.count > 100 { log.removeLast() }
    }

    func onUsernameRead(_ username: String) {
        Task { await report(username) }
    }

    private func prune() {
        let cutoff = Date().addingTimeInterval(-Self.peerTimeout)
        let before = peersByKey.count
        peersByKey = peersByKey.filter { $0.value.lastSeen > cutoff }
        if peersByKey.count != before { publishPeers() }
    }

    private func publishPeers() {
        peers = peersByKey.values.sorted { $0.username < $1.username }
    }
}
