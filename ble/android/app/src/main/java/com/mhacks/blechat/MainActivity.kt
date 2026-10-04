package com.mhacks.blechat

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.bluetooth.BluetoothManager
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.InputFilter
import android.text.InputType
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * One screen: a username, an Off / Method 1 / Method 2 switch, who's nearby, and a log.
 * Only one method runs at a time; both sides must pick the same one to see each other.
 * Method 1 runs only while this screen is open. Method 2 runs in BleService, so it
 * keeps going after the screen closes. See Method1Advertise.kt and Method2Gatt.kt
 * for how each works and how to deploy.
 */
class MainActivity : Activity(), BleListener {

    private enum class Mode { OFF, ADVERT, GATT }

    private val handler = Handler(Looper.getMainLooper())
    private val peers = LinkedHashMap<String, Peer>()
    private val logLines = ArrayDeque<String>()
    private var mode = Mode.OFF

    private lateinit var method1: Method1Advertise
    private lateinit var usernameInput: EditText
    private lateinit var modeGroup: RadioGroup
    private lateinit var nearbyTitle: TextView
    private lateinit var peerList: LinearLayout
    private lateinit var logView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        method1 = Method1Advertise(this, this)
        setContentView(buildUi())
        BleService.listener = this
        // Method 2 may still be running from before this screen was closed.
        val running = BleService.username
        if (running != null) {
            mode = Mode.GATT
            usernameInput.setText(running)
            usernameInput.isEnabled = false
            modeGroup.check(ID_GATT)
        } else if (BleService.wasOn(this) && hasPermissions()) {
            // Method 2 was on last time (e.g. before a reinstall or reboot): turn it back on.
            usernameInput.setText(BleService.savedUsername(this))
            modeGroup.check(ID_GATT)
        }
        if (!hasPermissions()) requestPermissions(PERMISSIONS + optionalPermissions(), REQUEST_PERMISSIONS)
        handler.post(refresh)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(refresh)
        method1.stop()
        // BleService keeps running; it just stops reporting to this screen.
        if (BleService.listener === this) BleService.listener = null
    }

    // ---- BleListener ------------------------------------------------------

    override fun onPeer(peer: Peer) {
        peers[peer.key] = peer
    }

    override fun onMessage(from: String, text: String) {
        onLog("MESSAGE from $from: $text")
        Toast.makeText(this, "$from: $text", Toast.LENGTH_LONG).show()
    }

    override fun onLog(line: String) {
        logLines.addFirst("${TIME.format(Date())}  $line")
        while (logLines.size > 100) logLines.removeLast()
        logView.text = logLines.joinToString("\n")
    }

    // ---- Mode switching ---------------------------------------------------

    private fun switchMode(newMode: Mode) {
        method1.stop()
        BleService.stop(this)
        peers.clear()
        mode = Mode.OFF
        usernameInput.isEnabled = true
        BleService.setWasOn(this, newMode == Mode.GATT)
        if (newMode == Mode.OFF) return render()

        if (!hasPermissions()) {
            onLog("Allow \"Nearby devices\" first")
            requestPermissions(PERMISSIONS + optionalPermissions(), REQUEST_PERMISSIONS)
            return modeGroup.check(ID_OFF)
        }
        if (getSystemService(BluetoothManager::class.java).adapter?.isEnabled != true) {
            onLog("Turn Bluetooth on first")
            return modeGroup.check(ID_OFF)
        }

        val username = usernameInput.text.toString().replace('\n', ' ').trim().ifEmpty { "anon" }
        usernameInput.isEnabled = false // the running method already broadcast the old one
        mode = newMode
        when (newMode) {
            Mode.ADVERT -> method1.start(username)
            Mode.GATT -> BleService.start(this, username)
            Mode.OFF -> Unit
        }
        render()
    }

    private fun hasPermissions() = PERMISSIONS.all { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }

    /** Only makes BleService's notification visible; everything works without it. */
    private fun optionalPermissions() =
        if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.POST_NOTIFICATIONS) else emptyArray()

    // ---- UI ---------------------------------------------------------------

    /** Drops anyone not heard from in a while and redraws, once a second. */
    private val refresh = object : Runnable {
        override fun run() {
            val cutoff = SystemClock.elapsedRealtime() - PEER_TIMEOUT_MS
            peers.values.removeAll { it.lastSeenMs < cutoff }
            render()
            handler.postDelayed(this, 1_000)
        }
    }

    private fun render() {
        nearbyTitle.text = if (mode == Mode.GATT) "Nearby (tap to message)" else "Nearby"
        peerList.removeAllViews()
        if (peers.isEmpty()) {
            peerList.addView(text(if (mode == Mode.OFF) "Pick a method to start" else "Nobody yet…").apply { alpha = 0.6f })
        }
        for (peer in peers.values.sortedBy { it.username }) {
            val row = text("${peer.username}    ${peer.rssi} dBm    via ${peer.via}", sizeSp = 17f).apply {
                setPadding(0, dp(10), 0, dp(10))
            }
            if (mode == Mode.GATT && peer.device != null) row.setOnClickListener { showSendDialog(peer) }
            peerList.addView(row)
        }
    }

    private fun showSendDialog(peer: Peer) {
        val input = EditText(this).apply {
            hint = "Message"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        }
        AlertDialog.Builder(this)
            .setTitle("Message ${peer.username}")
            .setView(input)
            .setPositiveButton("Send") { _, _ ->
                val text = input.text.toString().trim()
                if (text.isNotEmpty()) BleService.send(peer, text)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun buildUi(): View {
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(32), dp(20), dp(20))
        }
        column.addView(text("BleChat", sizeSp = 26f).apply { setTypeface(typeface, Typeface.BOLD) })

        column.addView(header("Instagram username"))
        usernameInput = EditText(this).apply {
            setText("android.${(100..999).random()}")
            setSingleLine()
            filters = arrayOf(InputFilter.LengthFilter(BleIds.MAX_USERNAME_BYTES))
        }
        column.addView(usernameInput)

        column.addView(header("Method"))
        modeGroup = RadioGroup(this).apply { orientation = RadioGroup.HORIZONTAL }
        listOf(ID_OFF to "Off", ID_ADVERT to "1: Advert", ID_GATT to "2: GATT").forEach { (id, label) ->
            modeGroup.addView(RadioButton(this).apply { this.id = id; text = label })
        }
        modeGroup.check(ID_OFF)
        modeGroup.setOnCheckedChangeListener { _, checkedId ->
            val newMode = when (checkedId) {
                ID_ADVERT -> Mode.ADVERT
                ID_GATT -> Mode.GATT
                else -> Mode.OFF
            }
            if (newMode != mode) switchMode(newMode)
        }
        column.addView(modeGroup)

        nearbyTitle = header("Nearby")
        column.addView(nearbyTitle)
        peerList = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        column.addView(peerList)

        column.addView(header("Log"))
        logView = text("", sizeSp = 12f).apply { typeface = Typeface.MONOSPACE }
        column.addView(logView)

        return ScrollView(this).apply { addView(column) }
    }

    private fun header(label: String) = text(label, sizeSp = 13f).apply {
        setTypeface(typeface, Typeface.BOLD)
        setPadding(0, dp(20), 0, dp(4))
        alpha = 0.7f
    }

    private fun text(value: String, sizeSp: Float = 15f) = TextView(this).apply {
        text = value
        textSize = sizeSp
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private companion object {
        val PERMISSIONS = arrayOf(
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_ADVERTISE,
            Manifest.permission.BLUETOOTH_CONNECT,
        )
        const val REQUEST_PERMISSIONS = 1
        const val ID_OFF = 1
        const val ID_ADVERT = 2
        const val ID_GATT = 3
        const val PEER_TIMEOUT_MS = 15_000L
        val TIME = SimpleDateFormat("HH:mm:ss", Locale.US)
    }
}
