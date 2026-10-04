import Foundation

/// Owns both methods and the state the screen shows. Only one method runs at a time;
/// both phones must pick the same one to see each other.
final class BleStore: ObservableObject, BleListener {
    /// Created at launch by AppDelegate, including background relaunches with no UI,
    /// so Method 2's state restoration finds its Bluetooth managers.
    static let shared = BleStore()

    enum Mode: String, CaseIterable, Identifiable {
        case off = "Off"
        case advert = "1: Advert"
        case gatt = "2: GATT"
        var id: String { rawValue }
    }

    @Published var username = UserDefaults.standard.string(forKey: "username") ?? "iphone.\(Int.random(in: 100...999))"
    @Published private(set) var mode: Mode = .off
    @Published private(set) var peers: [Peer] = []
    @Published private(set) var log: [String] = []

    private var peersByKey: [String: Peer] = [:]
    private lazy var method1 = Method1Advertise(listener: self)
    private lazy var method2 = Method2Gatt(listener: self)
    private var pruneTimer: Timer?
    private let time: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f
    }()

    private static let peerTimeout: TimeInterval = 15

    private init() {
        pruneTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.prune() }
        // Turn Method 2 back on if it was on last time: after a reboot, or when iOS
        // relaunches the app in the background for state restoration.
        if UserDefaults.standard.string(forKey: "mode") == Mode.gatt.rawValue {
            setMode(.gatt)
        }
    }

    func setMode(_ newMode: Mode) {
        method1.stop()
        method2.stop()
        peersByKey.removeAll()
        publishPeers()
        mode = newMode
        let trimmed = username.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespaces)
        let name = trimmed.isEmpty ? "anon" : trimmed
        UserDefaults.standard.set(newMode.rawValue, forKey: "mode")
        UserDefaults.standard.set(name, forKey: "username")
        switch newMode {
        case .off: break
        case .advert: method1.start(username: name)
        case .gatt: method2.start(username: name)
        }
    }

    func send(to peer: Peer, text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        method2.send(toKey: peer.key, text: trimmed)
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
        print("BleChat: \(line)") // shows in Xcode's console
        log.insert("\(time.string(from: Date()))  \(line)", at: 0)
        if log.count > 100 { log.removeLast() }
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
