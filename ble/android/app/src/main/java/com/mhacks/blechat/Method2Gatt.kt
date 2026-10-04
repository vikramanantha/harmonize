package com.mhacks.blechat

/*
 * ============================================================================
 * METHOD 2: every phone broadcasts, and any phone that hears one reads its username
 * ============================================================================
 *
 * The flow, the same on both phones:
 *   1. Broadcast: host a small GATT service (BleIds.M2_SERVICE) that serves
 *      USERNAME_CHAR, an Instagram-sized username (up to 30 characters), and
 *      advertise that the service exists.
 *   2. Listen: scan for other phones' broadcasts.
 *   3. On hearing one: connect, read USERNAME_CHAR, disconnect, and print the
 *      name ("read <name>" in the in-app log, Android logcat tag "BleChat", and
 *      the Xcode console). Each phone is re-read every 30 s while it stays nearby.
 * (INBOX_CHAR also lets you send a short message: tap a name in the list.)
 *
 * How each phone recognises a broadcast:
 *   Android broadcasts  the M2_SERVICE UUID in a normal advert. iPhones find it
 *                       even with BleChat in the background (iOS allows background
 *                       scans for a specific UUID).
 *   iPhone broadcasts   M2_SERVICE plus four "signature" UUIDs. With BleChat in
 *                       the background, iOS hides every UUID in Apple's
 *                       undocumented "overflow area": a 128-bit map in Apple
 *                       manufacturer data where each UUID sets one bit. Android
 *                       checks for BleChat's four bits (BleIds.overflowMatches,
 *                       based on David Young's reverse engineering), then connects
 *                       and reads the name. It's unofficial: Apple could change it
 *                       in any iOS update, and other apps on the iPhone can set the
 *                       same bits. Those false matches fail the GATT read and are
 *                       retried after 60 s.
 *
 * What works between your Android phone and your friend's iPhone:
 *   Both apps open                      both see each other within a few seconds
 *   iPhone app in background or locked  both still see each other (Android via
 *                                       the overflow area; the iPhone more slowly)
 *   Android app closed / screen off     still works: BleService keeps running
 *                                       behind a "BleChat is finding people
 *                                       nearby" notification
 *   iPhone app swiped away (force-quit) nothing works until it's opened again.
 *                                       (If iOS itself kills it in the
 *                                       background, state restoration relaunches
 *                                       it.)
 *   Two iPhones, both in background     usually not: an iPhone only reads
 *                                       another's overflow area while its own
 *                                       screen is on
 *
 * ---------------------------------------------------------------------------
 * Deploy to your Android phone
 * ---------------------------------------------------------------------------
 * 1. On the phone: Settings > About phone > tap "Build number" 7 times.
 *    Then Settings > System > Developer options > turn on "USB debugging".
 *    Plug it into the Mac and tap "Allow" on the USB debugging prompt.
 * 2. On the Mac, either open mhacks26/ble/android in Android Studio, pick the
 *    phone in the device dropdown and press Run, or from a terminal:
 *        cd mhacks26/ble/android
 *        export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
 *        ~/Library/Android/sdk/platform-tools/adb devices   # phone should be listed
 *        ./gradlew installDebug
 * 3. Open BleChat. Allow "Nearby devices" and notifications, and make sure
 *    Bluetooth is on.
 * 4. Let it run in the background: Settings > Apps > BleChat > Battery >
 *    "Unrestricted". Samsung, Xiaomi and similar phones kill background apps
 *    without this.
 * 5. To watch the printed usernames on the Mac:
 *        ~/Library/Android/sdk/platform-tools/adb logcat -s Harmonize
 *
 * ---------------------------------------------------------------------------
 * Deploy to your friend's iPhone
 * ---------------------------------------------------------------------------
 * You need a Mac with full Xcode (free on the App Store; the Command Line Tools
 * alone can't build iOS apps) and an Apple ID. A free Apple ID is enough.
 * 1. Generate and open the Xcode project:
 *        brew install xcodegen
 *        cd mhacks26/ble/ios && xcodegen     # writes BleChat.xcodeproj from project.yml
 *        open BleChat.xcodeproj
 *    project.yml already turns on the two Bluetooth background modes this method
 *    needs (bluetooth-central, bluetooth-peripheral).
 * 2. Xcode > Settings > Accounts: add the Apple ID. Then click the BleChat target
 *    > Signing & Capabilities: choose that team as "Team" and change the bundle ID
 *    to something unique, e.g. com.<yourname>.blechat.
 * 3. Plug the iPhone in and tap "Trust This Computer". On the iPhone:
 *    Settings > Privacy & Security > Developer Mode > On (it reboots).
 *    In Xcode, pick the iPhone as the run destination and press Run (Cmd-R).
 * 4. The first launch is blocked as "Untrusted Developer". On the iPhone:
 *    Settings > General > VPN & Device Management > tap the Apple ID > Trust.
 *    Press Run again and allow Bluetooth when asked.
 * 5. Pick "2: GATT" once with the app open. iOS only lets an app start
 *    advertising in the foreground; after that it keeps going in the background.
 *    BleChat remembers the choice and turns it back on at the next launch.
 * Apps signed with a free Apple ID stop opening after 7 days. Press Run again to
 * reinstall. To see printed usernames on the Mac, keep the iPhone plugged in and
 * watch Xcode's console, or read the log in the app.
 * Without XcodeGen: File > New > Project > iOS App named "BleChat" (SwiftUI),
 * delete the ContentView.swift and BleChatApp.swift Xcode generates, drag in every
 * .swift file from ios/BleChat, then in the target's Info tab add
 * "Privacy - Bluetooth Always Usage Description", and add the Background Modes
 * capability with "Uses Bluetooth LE accessories" and "Acts as a Bluetooth LE
 * accessory".
 *
 * ---------------------------------------------------------------------------
 * Try it
 * ---------------------------------------------------------------------------
 * On both phones: type an Instagram username and tap "2: GATT". Each phone should
 * log `read "<other username>"` within a few seconds. Then lock the iPhone: within
 * about 30 s the Android log should show the iPhone's name again, marked
 * "(GATT (iPhone overflow area))". That line proves the overflow trick works on
 * this iPhone.
 * "status 133" or "timed out" lines are normal BLE flakiness: the app retries
 * after 5 s. If it never connects, turn Bluetooth off and on again on both phones.
 * ============================================================================
 */

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.os.SystemClock
import java.io.ByteArrayOutputStream

// MainActivity requests all three Bluetooth permissions before calling start().
@SuppressLint("MissingPermission")
class Method2Gatt(private val context: Context, private val listener: BleListener) {

    private val manager = context.getSystemService(BluetoothManager::class.java)
    private val adapter = manager.adapter
    private val main = Handler(Looper.getMainLooper())

    // Read from GATT server callbacks, which run on a binder thread.
    @Volatile private var username = ""
    private var running = false
    private var server: BluetoothGattServer? = null

    // ---- Visitor state. Main thread only. ----

    private sealed class Op(val device: BluetoothDevice) {
        class ReadName(device: BluetoothDevice) : Op(device)
        class Send(device: BluetoothDevice, val bytes: ByteArray) : Op(device)
    }

    private val queue = ArrayDeque<Op>()
    private var current: Op? = null
    private var gatt: BluetoothGatt? = null
    private val names = HashMap<String, String>() // address -> username
    private val rssis = HashMap<String, Int>()
    private val vias = HashMap<String, String>() // address -> how we spotted it
    private val nextReadAtMs = HashMap<String, Long>()

    // Long writes arrive in pieces ("prepared writes") before an execute. Binder thread.
    private val incoming = HashMap<String, ByteArrayOutputStream>()

    fun start(username: String) {
        if (running) return
        this.username = username
        val gattServer = manager.openGattServer(context, serverCallback)
            ?: return listener.onLog("Method 2: couldn't open a GATT server (is Bluetooth on?)")
        running = true
        server = gattServer

        val service = BluetoothGattService(BleIds.M2_SERVICE, BluetoothGattService.SERVICE_TYPE_PRIMARY)
        service.addCharacteristic(
            BluetoothGattCharacteristic(
                BleIds.USERNAME_CHAR,
                BluetoothGattCharacteristic.PROPERTY_READ,
                BluetoothGattCharacteristic.PERMISSION_READ,
            ),
        )
        service.addCharacteristic(
            BluetoothGattCharacteristic(
                BleIds.INBOX_CHAR,
                BluetoothGattCharacteristic.PROPERTY_WRITE,
                BluetoothGattCharacteristic.PERMISSION_WRITE,
            ),
        )
        // Advertising starts in onServiceAdded, so nobody connects before the service exists.
        gattServer.addService(service)

        startScanning()
        main.postDelayed(restartScan, SCAN_RESTART_MS)
        listener.onLog("Method 2: hosting \"$username\" and scanning")
    }

    fun stop() {
        if (!running) return
        running = false
        // Both throw if Bluetooth was switched off in the meantime; nothing to stop then.
        runCatching { adapter.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback) }
        runCatching { adapter.bluetoothLeScanner?.stopScan(scanCallback) }
        main.removeCallbacks(timeout)
        main.removeCallbacks(restartScan)
        queue.clear()
        current = null
        gatt?.close()
        gatt = null
        server?.close()
        server = null
        names.clear()
        rssis.clear()
        vias.clear()
        nextReadAtMs.clear()
        synchronized(incoming) { incoming.clear() }
    }

    /** Queues a message to [peer]. The other phone's log shows it once the write lands. */
    fun send(peer: Peer, text: String) {
        val device = peer.device ?: return
        val bytes = utf8Prefix(username, BleIds.MAX_USERNAME_BYTES) +
            '\n'.code.toByte() +
            utf8Prefix(text, BleIds.MAX_MESSAGE_BYTES)
        enqueue(Op.Send(device, bytes))
    }

    // ---- Host side --------------------------------------------------------

    private fun startAdvertising() {
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .setConnectable(true)
            .build()
        // Flags (3) + 128-bit service UUID (18) = 21 of the 31 bytes; no name needed.
        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addServiceUuid(ParcelUuid(BleIds.M2_SERVICE))
            .build()
        adapter.bluetoothLeAdvertiser?.startAdvertising(settings, data, advertiseCallback)
            ?: listener.onLog("Method 2: this phone can't advertise BLE")
    }

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartFailure(errorCode: Int) {
            listener.onLog("Method 2: advertising failed (error $errorCode)")
        }
    }

    // Runs on a binder thread. sendResponse is safe from here; UI work is posted to main.
    private val serverCallback = object : BluetoothGattServerCallback() {
        override fun onServiceAdded(status: Int, service: BluetoothGattService) {
            main.post {
                if (!running) return@post
                if (status == BluetoothGatt.GATT_SUCCESS) startAdvertising()
                else listener.onLog("Method 2: adding the GATT service failed (status $status)")
            }
        }

        override fun onCharacteristicReadRequest(
            device: BluetoothDevice,
            requestId: Int,
            offset: Int,
            characteristic: BluetoothGattCharacteristic,
        ) {
            val s = server ?: return
            if (characteristic.uuid != BleIds.USERNAME_CHAR) {
                s.sendResponse(device, requestId, BluetoothGatt.GATT_READ_NOT_PERMITTED, offset, null)
                return
            }
            val value = utf8Prefix(username, BleIds.MAX_USERNAME_BYTES)
            if (offset > value.size) {
                s.sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_OFFSET, offset, null)
                return
            }
            s.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value.copyOfRange(offset, value.size))
        }

        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice,
            requestId: Int,
            characteristic: BluetoothGattCharacteristic,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray?,
        ) {
            val s = server ?: return
            val bytes = value ?: ByteArray(0)
            if (characteristic.uuid != BleIds.INBOX_CHAR) {
                if (responseNeeded) s.sendResponse(device, requestId, BluetoothGatt.GATT_WRITE_NOT_PERMITTED, offset, null)
                return
            }
            if (preparedWrite) {
                // Pieces arrive in offset order.
                synchronized(incoming) {
                    incoming.getOrPut(device.address) { ByteArrayOutputStream() }.write(bytes)
                }
            } else {
                deliver(bytes)
            }
            if (responseNeeded) s.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, bytes)
        }

        override fun onExecuteWrite(device: BluetoothDevice, requestId: Int, execute: Boolean) {
            val buffer = synchronized(incoming) { incoming.remove(device.address) }
            if (execute && buffer != null) deliver(buffer.toByteArray())
            server?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
        }
    }

    private fun deliver(bytes: ByteArray) {
        val text = String(bytes, Charsets.UTF_8)
        val from = text.substringBefore('\n', missingDelimiterValue = "someone")
        val body = text.substringAfter('\n', missingDelimiterValue = text)
        main.post { listener.onMessage(from, body) }
    }

    // ---- Visitor side -----------------------------------------------------

    private fun startScanning() {
        // Filters are OR'd. The Apple one matches every Apple advert, since the overflow
        // area isn't at a fixed position (see BleIds.overflowBits); onScanResult keeps
        // only the ones with BleChat's bits. Having filters at all is also what lets
        // Android keep scanning with the screen off.
        val filters = listOf(
            ScanFilter.Builder().setServiceUuid(ParcelUuid(BleIds.M2_SERVICE)).build(),
            ScanFilter.Builder().setManufacturerData(BleIds.APPLE_COMPANY_ID, ByteArray(0)).build(),
        )
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        try {
            adapter.bluetoothLeScanner?.startScan(filters, settings, scanCallback)
                ?: listener.onLog("Method 2: no BLE scanner (is Bluetooth on?)")
        } catch (e: IllegalStateException) {
            listener.onLog("Method 2: Bluetooth is off; will retry")
        }
    }

    // Android quietly downgrades a scan that runs for long (5 min on Samsung, 30 on
    // stock Android) and results stop arriving, so restart it before then.
    private val restartScan = object : Runnable {
        override fun run() {
            if (!running) return
            runCatching { adapter.bluetoothLeScanner?.stopScan(scanCallback) }
            startScanning()
            main.postDelayed(this, SCAN_RESTART_MS)
        }
    }

    // Scan callbacks arrive on the main thread.
    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val record = result.scanRecord ?: return
            val appleData = record.getManufacturerSpecificData(BleIds.APPLE_COMPANY_ID)
            val device = result.device
            val address = device.address
            logOverflow(address, appleData, result.rssi)
            val via = when {
                record.serviceUuids?.contains(ParcelUuid(BleIds.M2_SERVICE)) == true -> "GATT"
                BleIds.overflowMatches(appleData) -> "GATT (iPhone overflow area)"
                else -> return
            }
            rssis[address] = result.rssi
            vias[address] = via
            names[address]?.let { name ->
                listener.onPeer(Peer("m2:$address", name, result.rssi, via, device))
            }
            val due = SystemClock.elapsedRealtime() >= (nextReadAtMs[address] ?: 0L)
            val busy = current?.device?.address == address || queue.any { it.device.address == address }
            if (due && !busy) enqueue(Op.ReadName(device))
        }

        override fun onScanFailed(errorCode: Int) {
            listener.onLog("Method 2: scan failed (error $errorCode)")
        }
    }

    // Debugging the overflow trick: print each BleChat iPhone's overflow bits, at most
    // once per phone per 15 s. Expect bits 13, 50, 87 and 124, plus 23 for M2_SERVICE.
    // Set DEBUG_RAW_APPLE to see every nearby Apple advert instead, e.g. if a new iOS
    // changes the format again.
    private val lastOverflowLogMs = HashMap<String, Long>()

    private fun logOverflow(address: String, appleData: ByteArray?, rssi: Int) {
        if (DEBUG_RAW_APPLE && appleData != null && rssi > DEBUG_MIN_RSSI) {
            val now = SystemClock.elapsedRealtime()
            val key = "$address/${appleData.firstOrNull()}"
            if (now - (lastOverflowLogMs[key] ?: 0L) >= DEBUG_RAW_LOG_MS) {
                lastOverflowLogMs[key] = now
                listener.onLog("RAW Apple advert from $address at $rssi dBm: ${appleData.joinToString("") { "%02x".format(it) }}")
            }
        }
        if (!BleIds.overflowMatches(appleData)) return
        val now = SystemClock.elapsedRealtime()
        if (now - (lastOverflowLogMs[address] ?: 0L) < OVERFLOW_LOG_MS) return
        lastOverflowLogMs[address] = now
        listener.onLog("BleChat iPhone overflow advert from $address at $rssi dBm: bits ${BleIds.overflowBits(appleData)}")
    }

    private fun enqueue(op: Op) {
        queue.addLast(op)
        next()
    }

    private fun next() {
        if (!running || current != null) return
        val op = queue.removeFirstOrNull() ?: return
        current = op
        main.postDelayed(timeout, OP_TIMEOUT_MS)
        gatt = op.device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    }

    private val timeout = Runnable { finish(ok = false, reason = "timed out") }

    /** [reason] null with [ok] false: failed quietly (a phone that isn't running BleChat). */
    private fun finish(ok: Boolean, reason: String? = null, retryMs: Long = RETRY_MS) {
        val op = current ?: return
        main.removeCallbacks(timeout)
        if (!ok) {
            val what = if (op is Op.Send) "sending to" else "reading name from"
            if (reason != null) listener.onLog("Method 2: $what ${names[op.device.address] ?: op.device.address} failed: $reason")
            if (op is Op.ReadName) nextReadAtMs[op.device.address] = SystemClock.elapsedRealtime() + retryMs
        }
        // close() right after disconnect(): no callback comes back, which is what we want.
        gatt?.disconnect()
        gatt?.close()
        gatt = null
        current = null
        main.post { next() }
    }

    /** GATT client callbacks come on a binder thread; hop to main and drop stale connections. */
    private fun onMain(g: BluetoothGatt, block: () -> Unit) {
        main.post { if (g === gatt) block() }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) = onMain(g) {
            if (status == BluetoothGatt.GATT_SUCCESS && newState == BluetoothProfile.STATE_CONNECTED) {
                g.requestMtu(MTU)
            } else {
                finish(ok = false, reason = "disconnected (status $status)")
            }
        }

        // Called whether or not the bigger MTU was granted; either way, carry on.
        override fun onMtuChanged(g: BluetoothGatt, mtu: Int, status: Int) = onMain(g) {
            if (!g.discoverServices()) finish(ok = false, reason = "service discovery refused")
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) = onMain(g) {
            val service = g.getService(BleIds.M2_SERVICE)
                // Usually an iPhone whose other apps happened to set our overflow bits.
                ?: return@onMain finish(ok = false, reason = null, retryMs = NOT_BLECHAT_RETRY_MS)
            when (val op = current) {
                is Op.ReadName -> {
                    val ch = service.getCharacteristic(BleIds.USERNAME_CHAR)
                    if (ch == null || !g.readCharacteristic(ch)) finish(ok = false, reason = "read refused")
                }
                is Op.Send -> {
                    val ch = service.getCharacteristic(BleIds.INBOX_CHAR)
                    if (ch == null || !write(g, ch, op.bytes)) finish(ok = false, reason = "write refused")
                }
                null -> Unit
            }
        }

        // API 33+.
        override fun onCharacteristicRead(
            g: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
            status: Int,
        ) = onMain(g) { handleRead(value, status) }

        // API 31-32. Copy the value now: the characteristic object gets reused.
        @Deprecated("Replaced by the ByteArray overload on API 33")
        override fun onCharacteristicRead(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            if (Build.VERSION.SDK_INT >= 33) return
            val value = legacyValue(characteristic)
            onMain(g) { handleRead(value, status) }
        }

        override fun onCharacteristicWrite(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) =
            onMain(g) {
                val op = current ?: return@onMain
                if (status != BluetoothGatt.GATT_SUCCESS) return@onMain finish(ok = false, reason = "write status $status")
                listener.onLog("Method 2: sent to ${names[op.device.address] ?: op.device.address}")
                finish(ok = true)
            }
    }

    private fun handleRead(value: ByteArray, status: Int) {
        val op = current ?: return
        if (status != BluetoothGatt.GATT_SUCCESS) return finish(ok = false, reason = "read status $status")
        val address = op.device.address
        val name = String(value, Charsets.UTF_8)
        listener.onLog("Method 2: read \"$name\" from $address (${vias[address]})")
        names[address] = name
        nextReadAtMs[address] = SystemClock.elapsedRealtime() + REREAD_MS
        listener.onPeer(Peer("m2:$address", name, rssis[address] ?: 0, vias[address] ?: "GATT", op.device))
        listener.onUsernameRead(name)
        finish(ok = true)
    }

    private fun write(g: BluetoothGatt, ch: BluetoothGattCharacteristic, bytes: ByteArray): Boolean =
        if (Build.VERSION.SDK_INT >= 33) {
            g.writeCharacteristic(ch, bytes, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) ==
                BluetoothStatusCodes.SUCCESS
        } else {
            legacyWrite(g, ch, bytes)
        }

    @Suppress("DEPRECATION")
    private fun legacyWrite(g: BluetoothGatt, ch: BluetoothGattCharacteristic, bytes: ByteArray): Boolean {
        ch.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
        ch.value = bytes
        return g.writeCharacteristic(ch)
    }

    @Suppress("DEPRECATION")
    private fun legacyValue(ch: BluetoothGattCharacteristic): ByteArray = ch.value?.copyOf() ?: ByteArray(0)

    private companion object {
        /** Asks for room for a whole message in one packet; iPhones settle around 185. */
        const val MTU = 247
        const val OP_TIMEOUT_MS = 10_000L
        const val REREAD_MS = 30_000L
        const val RETRY_MS = 5_000L
        const val NOT_BLECHAT_RETRY_MS = 60_000L
        const val SCAN_RESTART_MS = 4 * 60_000L
        const val OVERFLOW_LOG_MS = 15_000L

        // Debugging: log the raw bytes of every nearby Apple advert (any type), at
        // most every 5 s per phone and type. Hold the iPhone next to the Pixel.
        const val DEBUG_RAW_APPLE = false
        const val DEBUG_MIN_RSSI = -65
        const val DEBUG_RAW_LOG_MS = 5_000L
    }
}
