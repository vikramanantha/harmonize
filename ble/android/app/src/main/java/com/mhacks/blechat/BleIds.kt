package com.mhacks.blechat

import android.bluetooth.BluetoothDevice
import android.os.SystemClock
import java.io.ByteArrayOutputStream
import java.util.UUID

/** Identifiers both apps agree on. Must match ios/BleChat/BleIds.swift exactly. */
object BleIds {
    /** Bluetooth SIG's reserved test company ID. Fine for a demo; a shipped app needs a real one. */
    const val COMPANY_ID = 0xFFFF

    /** First byte of our manufacturer data, so other apps also using 0xFFFF are ignored. */
    const val PAYLOAD_VERSION: Byte = 0x01

    /**
     * Method 1 only. Legacy advert = 31 bytes. Flags (3) + manufacturer header (2)
     * + company ID (2) + version (1) leaves 23; 20 keeps a little slack.
     */
    const val ADVERT_USERNAME_BYTES = 20

    /** Method 2: Instagram usernames are at most 30 characters, all ASCII. */
    const val MAX_USERNAME_BYTES = 30

    /** Username + newline + this fits one GATT write at the ~185-byte MTU iPhones negotiate. */
    const val MAX_MESSAGE_BYTES = 150

    /** Method 1, iPhone side: iOS can't send manufacturer data, so it advertises this UUID + a local name. */
    val M1_IOS_SERVICE: UUID = UUID.fromString("8C6A1E00-5F2B-4C11-9A3E-2B7D4F6A0001")

    /** Method 2: the GATT service every phone hosts and connects to. */
    val M2_SERVICE: UUID = UUID.fromString("8C6A1E00-5F2B-4C11-9A3E-2B7D4F6A0002")

    /** Method 2: readable, holds the host's username. */
    val USERNAME_CHAR: UUID = UUID.fromString("8C6A1E00-5F2B-4C11-9A3E-2B7D4F6A0003")

    /** Method 2: writable, receives "<sender username>\n<message>". */
    val INBOX_CHAR: UUID = UUID.fromString("8C6A1E00-5F2B-4C11-9A3E-2B7D4F6A0004")

    /**
     * Method 2, finding a backgrounded iPhone. iOS strips its advert down to Apple
     * manufacturer data containing an "overflow area": [0x01][16-byte bitmap], where
     * each advertised service UUID sets one bit chosen by an undocumented Apple hash.
     * On iOS 26 the overflow area comes after other Apple fields, e.g.
     *   10 07 3c1f1b5ab15408 | 01 00040100000020000000010000000008
     *   (Nearby Info)          (overflow: bits 13, 23, 50, 87, 124)
     * so it has to be found by walking the fields. BleChat iPhones advertise
     * the four UUIDs in BleIds.swift `overflowSignature`, which land on these bits
     * (read most significant bit first). Mapping from David Young's reverse
     * engineering: https://davidgyoungtech.com/2020/05/07/hacking-the-overflow-area
     */
    const val APPLE_COMPANY_ID = 0x004C
    val OVERFLOW_SIGNATURE_BITS = intArrayOf(13, 50, 87, 124)

    /**
     * True if this Apple advert looks like a BleChat iPhone. One missing bit is
     * allowed: in the foreground iOS moves one of the UUIDs into the normal advert.
     * Other apps on the same iPhone add bits too, so this can match phones that
     * aren't BleChat; the GATT read that follows weeds those out.
     */
    fun overflowMatches(appleData: ByteArray?): Boolean {
        val bits = overflowBits(appleData) ?: return false
        return OVERFLOW_SIGNATURE_BITS.count { it in bits } >= OVERFLOW_SIGNATURE_BITS.size - 1
    }

    /** The bit positions set in an Apple advert's overflow area, or null if it has none. */
    fun overflowBits(appleData: ByteArray?): Set<Int>? {
        val start = overflowStart(appleData ?: return null) ?: return null
        return (0 until 128).filterTo(sortedSetOf()) { bit ->
            (appleData[start + bit / 8].toInt() and (0x80 ushr (bit % 8))) != 0
        }
    }

    /**
     * Index of the 16-byte bitmap in Apple manufacturer data, or null. The data is a
     * run of [type][length][value] fields, except the overflow area (type 0x01), which
     * has no length byte and is always 16 bytes.
     */
    private fun overflowStart(data: ByteArray): Int? {
        var i = 0
        while (i < data.size) {
            if (data[i] == 0x01.toByte()) return if (i + 17 <= data.size) i + 1 else null
            if (i + 1 >= data.size) return null
            i += 2 + (data[i + 1].toInt() and 0xFF)
        }
        return null
    }
}

/** Someone nearby, from either method. [device] is set only for Method 2, which can connect back. */
data class Peer(
    val key: String,
    val username: String,
    val rssi: Int,
    val via: String,
    val device: BluetoothDevice? = null,
    val lastSeenMs: Long = SystemClock.elapsedRealtime(),
)

/** How both methods report back to the UI. Always called on the main thread. */
interface BleListener {
    fun onPeer(peer: Peer)
    fun onMessage(from: String, text: String)
    fun onLog(line: String)
}

/** [s] cut to at most [max] UTF-8 bytes without splitting a character. */
fun utf8Prefix(s: String, max: Int): ByteArray {
    val out = ByteArrayOutputStream()
    var i = 0
    while (i < s.length) {
        val cp = s.codePointAt(i)
        val bytes = String(Character.toChars(cp)).toByteArray(Charsets.UTF_8)
        if (out.size() + bytes.size > max) break
        out.write(bytes)
        i += Character.charCount(cp)
    }
    return out.toByteArray()
}
