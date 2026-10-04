package com.mhacks.blechat

import android.Manifest
import android.bluetooth.BluetoothManager
import android.content.Intent
import android.net.Uri
import android.telephony.SmsManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.Crossfade
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.mhacks.blechat.ui.HarmonizeTheme
import com.mhacks.blechat.ui.HomeScreen
import com.mhacks.blechat.ui.HomeState
import com.mhacks.blechat.ui.SignInScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * The whole app: sign in, then home (profile, nearby people, matches).
 * Bluetooth (Method 2, in BleService) starts by itself with the Instagram
 * username the server reported, and keeps running when the app is closed.
 */
class MainActivity : ComponentActivity(), BleListener {

    private var signedIn by mutableStateOf(false)
    private var devMode by mutableStateOf(false)
    private val home = HomeState()
    private val peers = LinkedHashMap<String, Peer>()

    private val permissionRequest = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        home.me?.username?.let { ensureBluetooth(it) }
    }

    private var askedForSms = false
    private val smsPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val line = home.me?.photonLine ?: return@registerForActivityResult
        if (granted) sendFirstText(line) else home.textsLine = line
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        signedIn = Api.isLoggedIn(this)
        devMode = Api.devMode(this)
        BleService.listener = this
        if (signedIn && !hasPermissions()) askPermissions()

        setContent {
            HarmonizeTheme {
              // Sets the screen background and the default text color for light and dark mode.
              Surface(color = MaterialTheme.colorScheme.background, contentColor = MaterialTheme.colorScheme.onBackground) {
                Crossfade(signedIn, label = "screen") { inApp ->
                    if (inApp) {
                        LaunchedEffect(Unit) { pollServer() }
                        LaunchedEffect(Unit) { prunePeers() }
                        HomeScreen(
                            state = home,
                            devMode = devMode,
                            serverUrl = Api.serverUrl(this),
                            onDevModeChange = ::setDev,
                            onSignOut = ::signOut,
                            onTurnOnTexts = ::openFirstText,
                        )
                    } else {
                        SignInScreen(devMode = devMode, onDevModeChange = ::setDev, onSignedIn = ::onSignedIn)
                    }
                }
              }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        // BleService keeps running; it just stops reporting to this screen.
        if (BleService.listener === this) BleService.listener = null
    }

    private fun setDev(on: Boolean) {
        devMode = on
        Api.setDevMode(this, on)
    }

    private fun onSignedIn(token: String) {
        Api.setToken(this, token)
        home.me = null
        home.serverError = null
        signedIn = true
        if (!hasPermissions()) askPermissions()
    }

    private fun signOut() {
        BleService.stop(this)
        BleService.setWasOn(this, false)
        Api.setToken(this, null)
        home.me = null
        home.serverError = null
        peers.clear()
        home.peers = emptyList()
        home.bluetoothOn = false
        signedIn = false
    }

    // ---- Server ---------------------------------------------------------

    /** Refreshes the profile and matches: every 5 s while setting up, then every 15 s. */
    private suspend fun pollServer() {
        while (signedIn) {
            try {
                val me = withContext(Dispatchers.IO) { Api.me(this@MainActivity) }
                home.me = me
                home.serverError = null
                if (me.profileStatus == "ready") {
                    me.username?.let { ensureBluetooth(it) }
                    ensureFirstText(me)
                }
            } catch (e: Exception) {
                val message = e.message ?: e.toString()
                if ("not logged in" in message.lowercase()) return signOut()
                home.serverError = message
            }
            home.bluetoothOn = BleService.isRunning
            delay(if (home.me?.profileStatus == "pending") 5_000 else 15_000)
        }
    }

    private fun ensureBluetooth(username: String) {
        if (!hasPermissions()) {
            home.bluetoothProblem = "Harmonize needs the Nearby devices permission to find people around you."
            return
        }
        if (getSystemService(BluetoothManager::class.java).adapter?.isEnabled != true) {
            home.bluetoothProblem = "Turn on Bluetooth so Harmonize can find people nearby."
            return
        }
        home.bluetoothProblem = null
        if (BleService.username != username) BleService.start(this, username)
        home.bluetoothOn = true
    }

    // ---- Photon first text ------------------------------------------------
    // On Photon's shared lines, a person must text their assigned line once
    // before Photon may text them. With SMS permission the app sends it; without,
    // the home screen offers a button that opens Messages pre-filled.

    private fun ensureFirstText(me: Api.Me) {
        val line = me.photonLine ?: return
        if (Api.firstTextSent(this, line)) return
        if (checkSelfPermission(Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED) {
            sendFirstText(line)
        } else if (!askedForSms) {
            askedForSms = true
            smsPermission.launch(Manifest.permission.SEND_SMS)
        } else {
            home.textsLine = line
        }
    }

    private fun sendFirstText(line: String) {
        try {
            getSystemService(SmsManager::class.java).sendTextMessage(line, null, FIRST_TEXT, null, null)
        } catch (e: Exception) {
            onLog("Couldn't send the first text to $line: ${e.message}")
            home.textsLine = line
            return
        }
        firstTextDone(line)
        onLog("Sent the first text to Photon ($line); match texts are on")
    }

    private fun openFirstText(line: String) {
        // Android's format is "smsto:<number>" plus an sms_body extra ("&body=" is the iPhone format).
        startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$line")).putExtra("sms_body", FIRST_TEXT))
        firstTextDone(line)
    }

    private fun firstTextDone(line: String) {
        Api.markFirstTextSent(this, line)
        home.textsLine = null
        Api.async({ Api.reportFirstText(this, line) }, { onLog("Reporting the first text to the server failed: $it") }) {}
    }

    private fun hasPermissions() = PERMISSIONS.all { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }

    private fun askPermissions() {
        val notifications = if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.POST_NOTIFICATIONS) else emptyArray()
        permissionRequest.launch(PERMISSIONS + notifications)
    }

    // ---- BleListener ----------------------------------------------------

    override fun onPeer(peer: Peer) {
        peers[peer.key] = peer
        home.peers = peers.values.sortedBy { it.username }
    }

    override fun onMessage(from: String, text: String) {
        onLog("MESSAGE from $from: $text")
    }

    override fun onLog(line: String) {
        home.log = (listOf("${TIME.format(Date())}  $line") + home.log).take(100)
    }

    /** Drops anyone not heard from in a while, once a second. */
    private suspend fun prunePeers() {
        while (signedIn) {
            val cutoff = SystemClock.elapsedRealtime() - PEER_TIMEOUT_MS
            if (peers.values.removeAll { it.lastSeenMs < cutoff }) home.peers = peers.values.sortedBy { it.username }
            home.bluetoothOn = BleService.isRunning
            delay(1_000)
        }
    }

    private companion object {
        val PERMISSIONS = arrayOf(
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_ADVERTISE,
            Manifest.permission.BLUETOOTH_CONNECT,
        )
        const val PEER_TIMEOUT_MS = 15_000L
        val TIME = SimpleDateFormat("HH:mm:ss", Locale.US)
        const val FIRST_TEXT = "Hi Harmonize! Turning on my match texts."
    }
}
