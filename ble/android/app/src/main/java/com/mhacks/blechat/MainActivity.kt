package com.mhacks.blechat

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Home screen once onboarding is done: who you are, who's nearby, your matches,
 * and a log. Bluetooth (Method 2, in BleService) starts by itself with the
 * Instagram username the server reported, and keeps running when this screen
 * closes. Method1Advertise.kt is kept for reference but no longer used.
 */
class MainActivity : Activity(), BleListener {

    private val handler = Handler(Looper.getMainLooper())
    private val peers = LinkedHashMap<String, Peer>()
    private val logLines = ArrayDeque<String>()
    private var me: Api.Me? = null
    private var serverError: String? = null

    private lateinit var youLine: TextView
    private lateinit var statusLine: TextView
    private lateinit var peerList: LinearLayout
    private lateinit var matchList: LinearLayout
    private lateinit var logView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Api.isLoggedIn(this)) return goToOnboarding()
        setContentView(buildUi())
        BleService.listener = this
        if (!hasPermissions()) requestPermissions(PERMISSIONS + optionalPermissions(), REQUEST_PERMISSIONS)
        handler.post(refreshMe)
        handler.post(prune)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        // BleService keeps running; it just stops reporting to this screen.
        if (BleService.listener === this) BleService.listener = null
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        me?.username?.let { ensureBluetooth(it) }
    }

    // ---- Server ---------------------------------------------------------

    /** Pulls profile status and matches every 15 s, and starts Bluetooth once the profile is ready. */
    private val refreshMe = object : Runnable {
        override fun run() {
            Api.async({ Api.me(this@MainActivity) }, { message ->
                serverError = message
                render()
                handler.postDelayed(this, REFRESH_MS)
            }) { result ->
                serverError = null
                me = result
                when (result.profileStatus) {
                    "ready" -> result.username?.let { ensureBluetooth(it) }
                    "error" -> return@async goToOnboarding() // shows the error and offers "Log in again"
                }
                render()
                handler.postDelayed(this, REFRESH_MS)
            }
        }
    }

    private fun ensureBluetooth(username: String) {
        if (!hasPermissions()) return
        if (getSystemService(BluetoothManager::class.java).adapter?.isEnabled != true) {
            if (!BleService.isRunning) onLog("Turn Bluetooth on to find people nearby")
            return
        }
        if (BleService.username != username) BleService.start(this, username)
    }

    private fun logout() {
        BleService.stop(this)
        BleService.setWasOn(this, false)
        Api.setToken(this, null)
        goToOnboarding()
    }

    private fun goToOnboarding() {
        startActivity(Intent(this, OnboardingActivity::class.java))
        finish()
    }

    private fun hasPermissions() = PERMISSIONS.all { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }

    /** Only makes BleService's notification visible; everything works without it. */
    private fun optionalPermissions() =
        if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.POST_NOTIFICATIONS) else emptyArray()

    // ---- BleListener ----------------------------------------------------

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

    // ---- UI -------------------------------------------------------------

    /** Drops anyone not heard from in a while and redraws, once a second. */
    private val prune = object : Runnable {
        override fun run() {
            val cutoff = SystemClock.elapsedRealtime() - PEER_TIMEOUT_MS
            peers.values.removeAll { it.lastSeenMs < cutoff }
            render()
            handler.postDelayed(this, 1_000)
        }
    }

    private fun render() {
        val me = me
        youLine.text = when {
            me?.username != null -> "${me.name ?: ""} @${me.username}".trim()
            else -> "Loading your profile…"
        }
        statusLine.text = when {
            serverError != null -> "Server: $serverError"
            me == null -> ""
            me.done -> "Your match was texted. Reporting is paused (LOOP is off)."
            me.refreshError != null -> "Daily summary refresh failed: ${me.refreshError}"
            BleService.isRunning -> "Sharing your username over Bluetooth · match threshold ${(me.threshold * 100).toInt()}%"
            else -> "Bluetooth not running"
        }

        peerList.removeAllViews()
        if (peers.isEmpty()) peerList.addView(text("Nobody yet…").apply { alpha = 0.6f })
        for (peer in peers.values.sortedBy { it.username }) {
            peerList.addView(text("@${peer.username}    ${peer.rssi} dBm", 16f).apply { setPadding(0, dp(6), 0, dp(6)) })
        }

        matchList.removeAllViews()
        val matches = me?.matches ?: emptyList()
        if (matches.isEmpty()) matchList.addView(text("No one scored yet").apply { alpha = 0.6f })
        for (m in matches) {
            val pct = (m.score * 100).toInt()
            val name = m.otherName?.let { "$it " } ?: ""
            val state = when {
                m.notifiedAt != null -> "texted"
                m.notifyError != null -> "text failed: ${m.notifyError}"
                m.matched -> "match"
                else -> "not a match"
            }
            matchList.addView(text("$name@${m.otherUsername}    $pct%    $state\n${m.verdict}", 15f).apply {
                setPadding(0, dp(8), 0, dp(8))
                if (m.matched) setTypeface(typeface, Typeface.BOLD)
            })
        }
    }

    private fun buildUi(): View {
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(32), dp(20), dp(20))
        }
        column.addView(text("Harmony", 26f).apply { setTypeface(typeface, Typeface.BOLD) })
        youLine = text("", 16f)
        column.addView(youLine)
        statusLine = text("", 13f).apply { alpha = 0.7f; setPadding(0, dp(4), 0, 0) }
        column.addView(statusLine)

        column.addView(header("Nearby"))
        peerList = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        column.addView(peerList)

        column.addView(header("Matches"))
        matchList = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        column.addView(matchList)

        column.addView(header("Log"))
        logView = text("", 12f).apply { typeface = Typeface.MONOSPACE }
        column.addView(logView)

        column.addView(Button(this).apply {
            text = "Log out"
            setOnClickListener { logout() }
        })
        return ScrollView(this).apply { addView(column) }
    }

    private fun header(label: String) = text(label, 13f).apply {
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
        const val REFRESH_MS = 15_000L
        const val PEER_TIMEOUT_MS = 15_000L
        val TIME = SimpleDateFormat("HH:mm:ss", Locale.US)
    }
}
