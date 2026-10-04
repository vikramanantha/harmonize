package com.mhacks.blechat

/*
 * ============================================================================
 * METHOD 1: put the username in the BLE advertisement itself
 * ============================================================================
 *
 * No connection and no pairing. Each phone keeps broadcasting a packet of up to
 * 31 bytes and listens for everyone else's.
 *
 *   Android broadcasts: manufacturer data, company 0xFFFF,
 *                       payload = [0x01 version][username, max 20 UTF-8 bytes]
 *   iPhone broadcasts:  service UUID BleIds.M1_IOS_SERVICE + local name = username
 *                       (iOS apps can't set manufacturer data, so this is the
 *                        only way for an iPhone to put text in an advert)
 *
 * Between your Android phone and your friend's iPhone:
 *   Android -> iPhone   works while BleChat is OPEN ON THE iPHONE'S SCREEN
 *                       (iOS only lets apps scan for "any device" in the foreground)
 *   iPhone  -> Android  works while BleChat is OPEN ON THE iPHONE'S SCREEN
 *                       (a backgrounded iPhone drops the local name from its advert)
 *   Android -> Android  works while BleChat is open
 *                       (this demo has no foreground service for background use)
 * Usernames are cut to 20 bytes: 20 plain letters, fewer with emoji.
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
 * 3. Open BleChat. Allow "Nearby devices" and make sure Bluetooth is on.
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
 * 2. Xcode > Settings > Accounts: add the Apple ID. Then click the BleChat target
 *    > Signing & Capabilities: choose that team as "Team" and change the bundle ID
 *    to something unique, e.g. com.<yourname>.blechat.
 * 3. Plug the iPhone in and tap "Trust This Computer". On the iPhone:
 *    Settings > Privacy & Security > Developer Mode > On (it reboots).
 *    In Xcode, pick the iPhone as the run destination and press Run (Cmd-R).
 * 4. The first launch is blocked as "Untrusted Developer". On the iPhone:
 *    Settings > General > VPN & Device Management > tap the Apple ID > Trust.
 *    Press Run again and allow Bluetooth when asked.
 * Apps signed with a free Apple ID stop opening after 7 days. Press Run again to
 * reinstall.
 * Without XcodeGen: File > New > Project > iOS App named "BleChat" (SwiftUI),
 * delete the ContentView.swift and BleChatApp.swift Xcode generates, drag in every
 * .swift file from ios/BleChat, then in the target's Info tab add
 * "Privacy - Bluetooth Always Usage Description". For Method 2 also add the
 * Background Modes capability with "Uses Bluetooth LE accessories" and
 * "Acts as a Bluetooth LE accessory".
 *
 * ---------------------------------------------------------------------------
 * Try it
 * ---------------------------------------------------------------------------
 * On both phones: type a username and tap "1: Advert". Within a second or two,
 * each phone should list the other under "Nearby" with a signal strength (closer
 * to 0 dBm means closer). Keep BleChat open on the iPhone. If the iPhone sees
 * nothing, check Settings > BleChat > Bluetooth is on.
 * Anyone running a BLE scanner app (e.g. nRF Connect) can read the username too.
 * ============================================================================
 */

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY
import android.bluetooth.le.AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.ParcelUuid

// MainActivity requests all three Bluetooth permissions before calling start().
@SuppressLint("MissingPermission")
class Method1Advertise(context: Context, private val listener: BleListener) {

    private val adapter = context.getSystemService(BluetoothManager::class.java).adapter
    private var running = false

    fun start(username: String) {
        if (running) return
        val advertiser = adapter.bluetoothLeAdvertiser
            ?: return listener.onLog("Method 1: this phone can't advertise BLE")
        val scanner = adapter.bluetoothLeScanner
            ?: return listener.onLog("Method 1: no BLE scanner (is Bluetooth on?)")
        running = true

        val payload = byteArrayOf(BleIds.PAYLOAD_VERSION) + utf8Prefix(username, BleIds.ADVERT_USERNAME_BYTES)
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(ADVERTISE_TX_POWER_MEDIUM)
            .setConnectable(false)
            .build()
        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addManufacturerData(BleIds.COMPANY_ID, payload)
            .build()
        advertiser.startAdvertising(settings, data, advertiseCallback)

        // Filters are OR'd: Android phones match on manufacturer data, iPhones on the UUID.
        val filters = listOf(
            ScanFilter.Builder()
                .setManufacturerData(
                    BleIds.COMPANY_ID,
                    byteArrayOf(BleIds.PAYLOAD_VERSION),
                    byteArrayOf(0xFF.toByte()),
                )
                .build(),
            ScanFilter.Builder().setServiceUuid(ParcelUuid(BleIds.M1_IOS_SERVICE)).build(),
        )
        val scanSettings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        scanner.startScan(filters, scanSettings, scanCallback)
        listener.onLog("Method 1: advertising \"$username\" and scanning")
    }

    fun stop() {
        if (!running) return
        running = false
        // Both throw if Bluetooth was switched off in the meantime; nothing to stop then.
        runCatching { adapter.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback) }
        runCatching { adapter.bluetoothLeScanner?.stopScan(scanCallback) }
    }

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartFailure(errorCode: Int) {
            listener.onLog("Method 1: advertising failed (error $errorCode)")
        }
    }

    // Scan callbacks arrive on the main thread.
    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val record = result.scanRecord ?: return
            val android = record.getManufacturerSpecificData(BleIds.COMPANY_ID)
            val (username, via) = when {
                android != null && android.isNotEmpty() && android[0] == BleIds.PAYLOAD_VERSION ->
                    String(android, 1, android.size - 1, Charsets.UTF_8) to "advert (Android)"
                // iOS may put the name in the scan response; Android merges that into scanRecord.
                record.serviceUuids?.contains(ParcelUuid(BleIds.M1_IOS_SERVICE)) == true ->
                    (record.deviceName ?: return) to "advert (iPhone name)"
                else -> return
            }
            // MAC addresses rotate, so the username is the only stable key here.
            listener.onPeer(Peer(key = "m1:$username", username = username, rssi = result.rssi, via = via))
        }

        override fun onScanFailed(errorCode: Int) {
            listener.onLog("Method 1: scan failed (error $errorCode)")
        }
    }
}
