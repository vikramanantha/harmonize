// METHOD 1: put the username in the BLE advertisement itself (iPhone side).
//
// How it works, what works between Android and iPhone, and how to deploy to both
// phones: see the header of android/app/src/main/java/com/mhacks/blechat/Method1Advertise.kt.
//
// iPhone-specific limits:
//  - iOS apps can't set manufacturer data, so the iPhone advertises
//    BleIds.m1IosService plus a local name, and Android reads the name.
//  - Scanning with no service filter (so Android adverts are heard) only works in
//    the foreground. In the background iOS also drops the local name. Keep the app
//    open on screen.

import CoreBluetooth

final class Method1Advertise: NSObject, CBCentralManagerDelegate, CBPeripheralManagerDelegate {
    private weak var listener: BleListener?
    // Created on first start(): creating them triggers the Bluetooth permission prompt.
    private var central: CBCentralManager?
    private var peripheral: CBPeripheralManager?
    private var username = ""
    private var running = false

    init(listener: BleListener) {
        self.listener = listener
    }

    func start(username: String) {
        self.username = username
        running = true
        // When the managers already exist and are powered on, no state callback comes, so call it ourselves.
        if let central { centralManagerDidUpdateState(central) } else {
            central = CBCentralManager(delegate: self, queue: nil)
        }
        if let peripheral { peripheralManagerDidUpdateState(peripheral) } else {
            peripheral = CBPeripheralManager(delegate: self, queue: nil)
        }
    }

    func stop() {
        running = false
        if central?.state == .poweredOn { central?.stopScan() }
        if peripheral?.state == .poweredOn { peripheral?.stopAdvertising() }
    }

    // MARK: Advertising

    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        guard running else { return }
        guard peripheral.state == .poweredOn else {
            listener?.onLog("Method 1: Bluetooth not ready (state \(peripheral.state.rawValue))")
            return
        }
        let name = String(decoding: utf8Prefix(username, max: BleIds.advertUsernameBytes), as: UTF8.self)
        peripheral.startAdvertising([
            CBAdvertisementDataServiceUUIDsKey: [BleIds.m1IosService],
            CBAdvertisementDataLocalNameKey: name,
        ])
    }

    func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
        if let error {
            listener?.onLog("Method 1: advertising failed: \(error.localizedDescription)")
        } else {
            listener?.onLog("Method 1: advertising \"\(username)\"")
        }
    }

    // MARK: Scanning

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard running, central.state == .poweredOn else { return }
        // nil services = hear everything, so Android adverts (no service UUID) come through. Foreground only.
        central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
        listener?.onLog("Method 1: scanning")
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        // Company ID 0xFFFF is little-endian on the air, which for 0xFFFF reads the same either way.
        let androidHeader: [UInt8] = [0xFF, 0xFF, BleIds.payloadVersion]
        let username: String
        let via: String
        if let data = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data,
           data.starts(with: androidHeader) {
            username = String(decoding: data.dropFirst(androidHeader.count), as: UTF8.self)
            via = "advert (Android)"
        } else if let uuids = advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID],
                  uuids.contains(BleIds.m1IosService),
                  let name = advertisementData[CBAdvertisementDataLocalNameKey] as? String {
            username = name
            via = "advert (iPhone name)"
        } else {
            return
        }
        // 127 means iOS couldn't measure it.
        let rssi = RSSI.intValue == 127 ? 0 : RSSI.intValue
        listener?.onPeer(Peer(key: "m1:\(username)", username: username, rssi: rssi, via: via))
    }
}
