import SwiftUI

/// One screen: a username, an Off / Method 1 / Method 2 switch, who's nearby, and a log.
struct ContentView: View {
    @ObservedObject private var store = BleStore.shared
    @State private var messageTarget: Peer?
    @State private var draft = ""

    var body: some View {
        NavigationStack {
            List {
                Section("You") {
                    TextField("Instagram username", text: $store.username)
                        .disabled(store.mode != .off) // the running method already broadcast the old one
                        .autocorrectionDisabled()
                    Picker("Method", selection: Binding(get: { store.mode }, set: { store.setMode($0) })) {
                        ForEach(BleStore.Mode.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }

                Section(store.mode == .gatt ? "Nearby (tap to message)" : "Nearby") {
                    if store.peers.isEmpty {
                        Text(store.mode == .off ? "Pick a method to start" : "Nobody yet…")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(store.peers) { peer in
                        Button {
                            if store.mode == .gatt { messageTarget = peer }
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(peer.username).font(.headline)
                                    Text("via \(peer.via)").font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("\(peer.rssi) dBm").monospacedDigit().foregroundStyle(.secondary)
                            }
                        }
                        .foregroundStyle(.primary)
                    }
                }

                Section("Log") {
                    ForEach(Array(store.log.enumerated()), id: \.offset) { _, line in
                        Text(line).font(.caption.monospaced())
                    }
                }
            }
            .navigationTitle("BleChat")
            .alert(
                "Message \(messageTarget?.username ?? "")",
                isPresented: Binding(get: { messageTarget != nil }, set: { if !$0 { messageTarget = nil } })
            ) {
                TextField("Message", text: $draft)
                Button("Send") {
                    if let peer = messageTarget { store.send(to: peer, text: draft) }
                    draft = ""
                }
                Button("Cancel", role: .cancel) { draft = "" }
            }
        }
    }
}
