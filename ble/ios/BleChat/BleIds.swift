import CoreBluetooth

/// Identifiers both apps agree on. Must match android/.../BleIds.kt exactly.
enum BleIds {
    /// Bluetooth SIG's reserved test company ID. iOS can only *read* manufacturer data.
    static let companyId: UInt16 = 0xFFFF
    /// First byte of the Android payload, after the company ID.
    static let payloadVersion: UInt8 = 0x01
    /// Method 1 only: what fits in a legacy advert next to the headers.
    static let advertUsernameBytes = 20
    /// Method 2: Instagram usernames are at most 30 characters, all ASCII.
    static let maxUsernameBytes = 30
    /// Username + newline + this fits one GATT write at the ~185-byte MTU iPhones negotiate.
    static let maxMessageBytes = 150

    /// Method 1: what an iPhone advertises next to its local name, since it can't send manufacturer data.
    static let m1IosService = CBUUID(string: "8C6A1E00-5F2B-4C11-9A3E-2B7D4F6A0001")
    /// Method 2: the GATT service every phone hosts and connects to.
    static let m2Service = CBUUID(string: "8C6A1E00-5F2B-4C11-9A3E-2B7D4F6A0002")
    /// Method 2: readable, holds the host's username.
    static let usernameChar = CBUUID(string: "8C6A1E00-5F2B-4C11-9A3E-2B7D4F6A0003")
    /// Method 2: writable, receives "<sender username>\n<message>".
    static let inboxChar = CBUUID(string: "8C6A1E00-5F2B-4C11-9A3E-2B7D4F6A0004")

    /// Method 2: advertised next to m2Service so Android can spot a backgrounded iPhone.
    /// In the background iOS replaces service UUIDs with a 128-bit "overflow area"
    /// bitmap; these four land on bits 13, 50, 87 and 124, which Android checks
    /// (BleIds.kt OVERFLOW_SIGNATURE_BITS). Table from David Young's reverse engineering:
    /// https://davidgyoungtech.com/2020/05/07/hacking-the-overflow-area
    static let overflowSignature = [
        CBUUID(string: "00000000-0000-0000-0000-000000000058"), // bit 13
        CBUUID(string: "00000000-0000-0000-0000-00000000005F"), // bit 50
        CBUUID(string: "00000000-0000-0000-0000-000000000052"), // bit 87
        CBUUID(string: "00000000-0000-0000-0000-000000000060"), // bit 124
    ]
}

/// Someone nearby, from either method.
struct Peer: Identifiable {
    let key: String
    var username: String
    var rssi: Int
    var via: String
    var lastSeen = Date()
    var id: String { key }
}

/// How both methods report back to the UI. Always called on the main queue.
protocol BleListener: AnyObject {
    func onPeer(_ peer: Peer)
    func onMessage(from: String, text: String)
    func onLog(_ line: String)
    /// Method 2 read `username` from a nearby phone (every read, about every 30 s per phone).
    func onUsernameRead(_ username: String)
}

extension BleListener {
    func onUsernameRead(_ username: String) {}
}

/// `s` cut to at most `max` UTF-8 bytes without splitting a character.
func utf8Prefix(_ s: String, max: Int) -> Data {
    var out = Data()
    for character in s {
        let bytes = Data(String(character).utf8)
        if out.count + bytes.count > max { break }
        out.append(bytes)
    }
    return out
}
