// METHOD 2: every phone broadcasts, and any phone that hears one reads its username (iPhone side).
//
// How it works, what works between Android and iPhone, and how to deploy to both
// phones: see the header of android/app/src/main/java/com/mhacks/blechat/Method2Gatt.kt.
//
// iPhone-specific notes:
//  - Broadcasting: a CBPeripheralManager serves USERNAME_CHAR (read) and INBOX_CHAR
//    (write), and advertises m2Service plus BleIds.overflowSignature. In the
//    background iOS turns those into overflow-area bits, which Android looks for.
//  - Listening: a CBCentralManager scans for m2Service and does one connect ->
//    read or write -> disconnect at a time.
//  - The bluetooth-central and bluetooth-peripheral background modes (project.yml)
//    keep both jobs alive in the background. Advertising has to be started in the
//    foreground; after that iOS keeps it going.
//  - State restoration: if iOS kills the app in the background, it relaunches it
//    when Bluetooth activity needs it, as long as BleStore recreates this class at
//    launch with the same restore identifiers (it does when 2: GATT was last on).
//    A force-quit from the app switcher turns all of this off until the next launch.

import CoreBluetooth

final class Method2Gatt: NSObject, CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate {
    private enum Kind {
        case readName
        case send(Data)
    }

    private struct Op {
        let peripheral: CBPeripheral
        let kind: Kind
        var connected = false
    }

    private weak var listener: BleListener?
    private var central: CBCentralManager?
    private var peripheralManager: CBPeripheralManager?
    private var username = ""
    private var running = false
    private var serviceAdded = false

    // Visitor state. CBPeripheral.identifier is iOS's stable-ish ID for the other phone.
    private var known: [UUID: CBPeripheral] = [:] // strong refs, or iOS drops them mid-connect
    private var names: [UUID: String] = [:]
    private var rssis: [UUID: Int] = [:]
    private var nextReadAt: [UUID: Date] = [:]
    private var queue: [Op] = []
    private var current: Op?
    private var timeout: DispatchWorkItem?

    private static let opTimeout: TimeInterval = 10
    private static let rereadAfter: TimeInterval = 30
    private static let retryAfter: TimeInterval = 5
    private static let notBleChatRetryAfter: TimeInterval = 60
    private static let centralRestoreId = "blechat.method2.central"
    private static let peripheralRestoreId = "blechat.method2.peripheral"

    init(listener: BleListener) {
        self.listener = listener
    }

    func start(username: String) {
        self.username = username
        running = true
        // When the managers already exist and are powered on, no state callback comes, so call it ourselves.
        if let central { centralManagerDidUpdateState(central) } else {
            central = CBCentralManager(
                delegate: self,
                queue: nil,
                options: [CBCentralManagerOptionRestoreIdentifierKey: Self.centralRestoreId]
            )
        }
        if let peripheralManager { peripheralManagerDidUpdateState(peripheralManager) } else {
            peripheralManager = CBPeripheralManager(
                delegate: self,
                queue: nil,
                options: [CBPeripheralManagerOptionRestoreIdentifierKey: Self.peripheralRestoreId]
            )
        }
    }

    func stop() {
        running = false
        timeout?.cancel()
        timeout = nil
        if central?.state == .poweredOn {
            central?.stopScan()
            if let op = current { central?.cancelPeripheralConnection(op.peripheral) }
        }
        if peripheralManager?.state == .poweredOn {
            peripheralManager?.stopAdvertising()
            peripheralManager?.removeAllServices()
        }
        serviceAdded = false
        queue.removeAll()
        current = nil
        known.removeAll()
        names.removeAll()
        rssis.removeAll()
        nextReadAt.removeAll()
    }

    /// Queues a message to the peer with this key ("m2:<identifier>").
    func send(toKey key: String, text: String) {
        guard let id = UUID(uuidString: String(key.dropFirst("m2:".count))), let peripheral = known[id] else { return }
        var data = utf8Prefix(username, max: BleIds.maxUsernameBytes)
        data.append(0x0A) // "\n"
        data.append(utf8Prefix(text, max: BleIds.maxMessageBytes))
        enqueue(Op(peripheral: peripheral, kind: .send(data)))
    }

    // MARK: State restoration

    // Called before the state callbacks when iOS relaunches the app in the background.
    func peripheralManager(_ peripheral: CBPeripheralManager, willRestoreState dict: [String: Any]) {
        let services = dict[CBPeripheralManagerRestoredStateServicesKey] as? [CBMutableService] ?? []
        // The service and its advert survived; adding it again would make a duplicate.
        if services.contains(where: { $0.uuid == BleIds.m2Service }) { serviceAdded = true }
        listener?.onLog("Method 2: relaunched by iOS, still broadcasting")
    }

    func centralManager(_ central: CBCentralManager, willRestoreState dict: [String: Any]) {
        // Any connection in flight was to a phone we'll simply rediscover; drop it.
        let peripherals = dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral] ?? []
        for peripheral in peripherals { central.cancelPeripheralConnection(peripheral) }
    }

    // MARK: Broadcasting (host side)

    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        guard running else { return }
        guard peripheral.state == .poweredOn else {
            listener?.onLog("Method 2: Bluetooth not ready (state \(peripheral.state.rawValue))")
            return
        }
        guard !serviceAdded else { return }
        serviceAdded = true
        let service = CBMutableService(type: BleIds.m2Service, primary: true)
        // value: nil = answer each read in didReceiveRead, so the current username is always served.
        service.characteristics = [
            CBMutableCharacteristic(type: BleIds.usernameChar, properties: [.read], value: nil, permissions: [.readable]),
            CBMutableCharacteristic(type: BleIds.inboxChar, properties: [.write], value: nil, permissions: [.writeable]),
        ]
        // Advertising starts in didAdd, so nobody connects before the service exists.
        peripheral.add(service)
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        if let error {
            listener?.onLog("Method 2: adding the GATT service failed: \(error.localizedDescription)")
            return
        }
        guard running else { return }
        let name = String(decoding: utf8Prefix(username, max: BleIds.maxUsernameBytes), as: UTF8.self)
        // m2Service first so it's the one UUID that fits in a foreground advert;
        // the rest go to the overflow area, where Android looks for them.
        peripheral.startAdvertising([
            CBAdvertisementDataServiceUUIDsKey: [BleIds.m2Service] + BleIds.overflowSignature,
            CBAdvertisementDataLocalNameKey: name,
        ])
        listener?.onLog("Method 2: hosting \"\(username)\"")
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
        guard request.characteristic.uuid == BleIds.usernameChar else {
            peripheral.respond(to: request, withResult: .readNotPermitted)
            return
        }
        let value = utf8Prefix(username, max: BleIds.maxUsernameBytes)
        guard request.offset <= value.count else {
            peripheral.respond(to: request, withResult: .invalidOffset)
            return
        }
        request.value = value.subdata(in: request.offset..<value.count)
        peripheral.respond(to: request, withResult: .success)
    }

    // A long write arrives as several requests in one call; answering the first answers them all.
    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        guard let first = requests.first else { return }
        guard requests.allSatisfy({ $0.characteristic.uuid == BleIds.inboxChar }) else {
            peripheral.respond(to: first, withResult: .writeNotPermitted)
            return
        }
        var data = Data()
        for request in requests.sorted(by: { $0.offset < $1.offset }) {
            if let value = request.value { data.append(value) }
        }
        peripheral.respond(to: first, withResult: .success)

        let text = String(decoding: data, as: UTF8.self)
        if let newline = text.firstIndex(of: "\n") {
            listener?.onMessage(from: String(text[..<newline]), text: String(text[text.index(after: newline)...]))
        } else {
            listener?.onMessage(from: "someone", text: text)
        }
    }

    // MARK: Listening (visitor side)

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard running, central.state == .poweredOn else { return }
        // A service filter is what lets iOS keep scanning in the background.
        central.scanForPeripherals(
            withServices: [BleIds.m2Service],
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
        )
        listener?.onLog("Method 2: scanning")
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        let id = peripheral.identifier
        known[id] = peripheral
        let rssi = RSSI.intValue == 127 ? 0 : RSSI.intValue // 127 = not measured
        rssis[id] = rssi
        if let name = names[id] {
            listener?.onPeer(Peer(key: "m2:\(id.uuidString)", username: name, rssi: rssi, via: "GATT"))
        }
        let due = nextReadAt[id].map { $0 <= Date() } ?? true
        let busy = current?.peripheral.identifier == id || queue.contains { $0.peripheral.identifier == id }
        if due && !busy { enqueue(Op(peripheral: peripheral, kind: .readName)) }
    }

    private func enqueue(_ op: Op) {
        queue.append(op)
        next()
    }

    private func next() {
        guard running, current == nil, !queue.isEmpty, let central else { return }
        let op = queue.removeFirst()
        current = op
        let work = DispatchWorkItem { [weak self] in self?.finish(op.peripheral, ok: false, "timed out") }
        timeout = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.opTimeout, execute: work)
        central.connect(op.peripheral)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard current?.peripheral == peripheral else { return }
        current?.connected = true
        peripheral.delegate = self
        peripheral.discoverServices([BleIds.m2Service])
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        guard current?.peripheral == peripheral, current?.connected == false else { return }
        finish(peripheral, ok: false, error?.localizedDescription ?? "couldn't connect")
    }

    // Only counts while the current op is connected: a late disconnect from the
    // previous op on the same phone must not cancel the next one.
    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        guard current?.peripheral == peripheral, current?.connected == true else { return }
        finish(peripheral, ok: false, error?.localizedDescription ?? "disconnected")
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard current?.peripheral == peripheral else { return }
        guard let service = peripheral.services?.first(where: { $0.uuid == BleIds.m2Service }) else {
            finish(peripheral, ok: false, "no BleChat service")
            nextReadAt[peripheral.identifier] = Date().addingTimeInterval(Self.notBleChatRetryAfter)
            return
        }
        peripheral.discoverCharacteristics([BleIds.usernameChar, BleIds.inboxChar], for: service)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard let op = current, op.peripheral == peripheral else { return }
        let characteristics = service.characteristics ?? []
        switch op.kind {
        case .readName:
            guard let ch = characteristics.first(where: { $0.uuid == BleIds.usernameChar }) else {
                finish(peripheral, ok: false, "no username characteristic")
                return
            }
            peripheral.readValue(for: ch)
        case .send(let data):
            guard let ch = characteristics.first(where: { $0.uuid == BleIds.inboxChar }) else {
                finish(peripheral, ok: false, "no inbox characteristic")
                return
            }
            peripheral.writeValue(data, for: ch, type: .withResponse)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard current?.peripheral == peripheral, characteristic.uuid == BleIds.usernameChar else { return }
        if let error {
            finish(peripheral, ok: false, error.localizedDescription)
            return
        }
        let id = peripheral.identifier
        let name = String(decoding: characteristic.value ?? Data(), as: UTF8.self)
        listener?.onLog("Method 2: read \"\(name)\"")
        names[id] = name
        nextReadAt[id] = Date().addingTimeInterval(Self.rereadAfter)
        listener?.onPeer(Peer(key: "m2:\(id.uuidString)", username: name, rssi: rssis[id] ?? 0, via: "GATT"))
        finish(peripheral, ok: true, nil)
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        guard current?.peripheral == peripheral else { return }
        if let error {
            finish(peripheral, ok: false, error.localizedDescription)
        } else {
            listener?.onLog("Method 2: sent to \(names[peripheral.identifier] ?? "?")")
            finish(peripheral, ok: true, nil)
        }
    }

    private func finish(_ peripheral: CBPeripheral, ok: Bool, _ reason: String?) {
        guard let op = current, op.peripheral == peripheral else { return }
        timeout?.cancel()
        timeout = nil
        if !ok {
            let name = names[peripheral.identifier] ?? "a nearby phone"
            switch op.kind {
            case .readName:
                listener?.onLog("Method 2: reading \(name) failed: \(reason ?? "")")
                nextReadAt[peripheral.identifier] = Date().addingTimeInterval(Self.retryAfter)
            case .send:
                listener?.onLog("Method 2: sending to \(name) failed: \(reason ?? "")")
            }
        }
        central?.cancelPeripheralConnection(peripheral)
        current = nil
        DispatchQueue.main.async { [weak self] in self?.next() }
    }
}
