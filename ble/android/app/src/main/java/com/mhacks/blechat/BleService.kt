package com.mhacks.blechat

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.concurrent.Executors

/**
 * Keeps Method 2 running with the app closed or the screen off. Android requires the
 * ongoing notification for that. Every username read over Bluetooth is reported to
 * the Harmony server, which scores the pair and texts both people on a match.
 * Everything is printed to logcat (tag "BleChat") and forwarded to the screen when
 * it's open.
 */
class BleService : Service() {

    private lateinit var method2: Method2Gatt
    private val main = Handler(Looper.getMainLooper())
    private val reporter = Executors.newSingleThreadExecutor()

    // Set when the server says this user's match was already texted and LOOP is off.
    @Volatile private var reportingStopped = false

    private val relay = object : BleListener {
        override fun onPeer(peer: Peer) {
            listener?.onPeer(peer)
        }

        override fun onMessage(from: String, text: String) {
            Log.i(TAG, "MESSAGE from $from: $text")
            listener?.onMessage(from, text)
        }

        override fun onLog(line: String) {
            Log.i(TAG, line)
            listener?.onLog(line)
        }

        override fun onUsernameRead(username: String) {
            report(username)
        }
    }

    /** Tells the server we're near [username]; the result (or error) goes to the log. */
    private fun report(username: String) {
        if (reportingStopped) return
        reporter.execute {
            val line = try {
                describe(Api.encounter(this, username))
            } catch (e: Exception) {
                "Reporting @$username to the server failed: ${e.message}"
            }
            main.post { relay.onLog(line) }
        }
    }

    private fun describe(r: Api.Encounter): String {
        val who = "@${r.otherUsername}"
        val pct = r.score?.let { "${(it * 100).toInt()}%" } ?: "?"
        return when (r.status) {
            "done" -> {
                reportingStopped = true
                "Your match was already texted; reporting stopped (LOOP is off)"
            }
            "no_profile" -> "$who: no taste profile in the database yet"
            "not_a_match" -> "$who: $pct, not a match"
            "match_waiting" -> "$who: $pct, MATCH. Waiting for their phone to see you too"
            "match_no_consent" -> "$who: $pct, MATCH, but one of you turned off texts"
            "already_notified" -> "$who: $pct, MATCH (already texted)"
            "notified" -> "$who: $pct, MATCH. Texted you both"
            else -> "$who: ${r.status}"
        }
    }

    override fun onCreate() {
        super.onCreate()
        method2 = Method2Gatt(this, relay)
        instance = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // A null intent means Android restarted us after killing the process (START_STICKY).
        val name = intent?.getStringExtra(EXTRA_USERNAME) ?: savedUsername(this)
        startForeground(NOTIFICATION_ID, buildNotification(name), ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        if (name != username) {
            method2.stop()
            username = name
            method2.start(name)
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        reporter.shutdownNow()
        method2.stop()
        username = null
        instance = null
    }

    override fun onBind(intent: Intent?) = null

    private fun buildNotification(name: String): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Finding people nearby", NotificationManager.IMPORTANCE_LOW),
            )
        }
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("BleChat is finding people nearby")
            .setContentText("Sharing \"$name\" over Bluetooth")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(openApp)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val TAG = "BleChat"
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "nearby"
        private const val EXTRA_USERNAME = "username"
        private const val PREFS = "blechat"
        private const val PREF_USERNAME = "username"
        private const val PREF_ON = "on"

        /** The screen, while it's open. Main thread only. */
        var listener: BleListener? = null

        private var instance: BleService? = null

        /** The username being shared, or null when the service isn't running. */
        var username: String? = null
            private set

        val isRunning get() = instance != null

        fun start(context: Context, username: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(PREF_USERNAME, username).apply()
            context.startForegroundService(Intent(context, BleService::class.java).putExtra(EXTRA_USERNAME, username))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, BleService::class.java))
        }

        fun send(peer: Peer, text: String) {
            instance?.let { it.method2.send(peer, text) }
        }

        /** The last username Method 2 shared, kept across restarts. */
        fun savedUsername(context: Context) =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PREF_USERNAME, null) ?: "anon"

        /** Whether Method 2 was on when the app was last used, so launching turns it back on. */
        fun wasOn(context: Context) =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(PREF_ON, false)

        fun setWasOn(context: Context, on: Boolean) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(PREF_ON, on).apply()
        }
    }
}
