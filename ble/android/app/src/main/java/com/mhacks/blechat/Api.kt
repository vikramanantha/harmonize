package com.mhacks.blechat

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * The Harmonize server (mhacks26/app/api/app/...). Calls are synchronous and throw
 * [ApiException] with the server's message; use [Api.async] from the UI.
 * The server URL and device token live in SharedPreferences.
 */
class ApiException(message: String) : IOException(message)

object Api {
    private const val PREFS = "harmony"
    private const val PREF_SERVER = "server_url"
    private const val PREF_TOKEN = "device_token"
    private const val PREF_DEV = "dev_mode"

    private val executor = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    data class LoginStep(val step: String, val loginId: String?, val deviceToken: String?)

    data class Match(
        val otherUsername: String,
        val otherName: String?,
        val score: Double,
        val verdict: String,
        val matched: Boolean,
        val notifiedAt: Long?,
        val notifyError: String?,
    )

    data class Me(
        val profileStatus: String,
        val profileError: String?,
        val refreshError: String?,
        val username: String?,
        val name: String?,
        val loop: Boolean,
        val threshold: Double,
        val done: Boolean,
        val matches: List<Match>,
        /** The Photon number this person must text once before Photon may text them; null if texts are off. */
        val photonLine: String?,
        val firstTextAt: Long?,
    )

    data class Encounter(val status: String, val otherUsername: String, val otherName: String?, val score: Double?, val verdict: String?)

    fun serverUrl(context: Context): String = prefs(context).getString(PREF_SERVER, "") ?: ""
    fun token(context: Context): String? = prefs(context).getString(PREF_TOKEN, null)
    fun isLoggedIn(context: Context) = token(context) != null

    fun setServerUrl(context: Context, url: String) {
        prefs(context).edit().putString(PREF_SERVER, url.trim().trimEnd('/')).apply()
    }

    /** Developer mode: shows the log, server details and raw errors. */
    fun devMode(context: Context) = prefs(context).getBoolean(PREF_DEV, false)

    fun setDevMode(context: Context, on: Boolean) {
        prefs(context).edit().putBoolean(PREF_DEV, on).apply()
    }

    fun setToken(context: Context, token: String?) {
        prefs(context).edit().putString(PREF_TOKEN, token).apply()
    }

    /** Runs [work] off the main thread and hands its result, or the error, back on it. */
    fun <T> async(work: () -> T, onError: (String) -> Unit, onResult: (T) -> Unit) {
        executor.execute {
            try {
                val result = work()
                main.post { onResult(result) }
            } catch (e: Exception) {
                main.post { onError(e.message ?: e.toString()) }
            }
        }
    }

    fun loginStart(context: Context, identifier: String, phone: String, consent: Boolean, autoApprove: Boolean): LoginStep =
        parseLogin(post(context, "/api/app/login/start", JSONObject().put("identifier", identifier).put("phone_number", phone).put("consent", consent).put("auto_approve", autoApprove), auth = false))

    fun loginVerify(context: Context, loginId: String, credential: String): LoginStep =
        parseLogin(post(context, "/api/app/login/verify", JSONObject().put("login_id", loginId).put("credential", credential), auth = false))

    fun me(context: Context): Me {
        val j = request(context, "GET", "/api/app/me", null, auth = true)
        val matches = j.getJSONArray("matches")
        return Me(
            profileStatus = j.getString("profile_status"),
            profileError = j.optStringOrNull("profile_error"),
            refreshError = j.optStringOrNull("refresh_error"),
            username = j.optStringOrNull("username"),
            name = j.optStringOrNull("name"),
            loop = j.getBoolean("loop"),
            threshold = j.getDouble("match_threshold"),
            done = j.getBoolean("done"),
            photonLine = j.optStringOrNull("photon_line"),
            firstTextAt = if (j.has("first_text_at") && !j.isNull("first_text_at")) j.getLong("first_text_at") else null,
            matches = (0 until matches.length()).map { i ->
                val m = matches.getJSONObject(i)
                Match(
                    otherUsername = m.getString("other_username"),
                    otherName = m.optStringOrNull("other_name"),
                    score = m.getDouble("score"),
                    verdict = m.getString("verdict"),
                    matched = m.getBoolean("matched"),
                    notifiedAt = if (m.isNull("notified_at")) null else m.getLong("notified_at"),
                    notifyError = m.optStringOrNull("notify_error"),
                )
            },
        )
    }

    fun encounter(context: Context, otherUsername: String): Encounter {
        val j = post(context, "/api/app/encounters", JSONObject().put("other_username", otherUsername), auth = true)
        return Encounter(
            status = j.getString("status"),
            otherUsername = j.getString("other_username"),
            otherName = j.optStringOrNull("other_name"),
            score = if (j.has("score") && !j.isNull("score")) j.getDouble("score") else null,
            verdict = j.optStringOrNull("verdict"),
        )
    }

    fun reportFirstText(context: Context, line: String) {
        post(context, "/api/app/photon/first-text", JSONObject().put("line", line), auth = true)
    }

    /** Whether this phone already sent its one-time first text to [line]. */
    fun firstTextSent(context: Context, line: String) = prefs(context).getBoolean("first_text_$line", false)

    fun markFirstTextSent(context: Context, line: String) {
        prefs(context).edit().putBoolean("first_text_$line", true).apply()
    }

    private fun parseLogin(j: JSONObject) =
        LoginStep(step = j.getString("step"), loginId = j.optStringOrNull("login_id"), deviceToken = j.optStringOrNull("device_token"))

    private fun post(context: Context, path: String, body: JSONObject, auth: Boolean) = request(context, "POST", path, body, auth)

    private fun request(context: Context, method: String, path: String, body: JSONObject?, auth: Boolean): JSONObject {
        val base = serverUrl(context)
        if (base.isEmpty()) throw ApiException("No server URL set")
        val connection = URL(base + path).openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = 20_000
        connection.readTimeout = 120_000 // Muse login steps drive a remote browser
        connection.setRequestProperty("Accept", "application/json")
        if (auth) {
            val token = token(context) ?: throw ApiException("Not logged in")
            connection.setRequestProperty("Authorization", "Bearer $token")
        }
        if (body != null) {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(body.toString().toByteArray()) }
        }
        val status = try {
            connection.responseCode
        } catch (e: IOException) {
            throw ApiException("Can't reach $base: ${e.message}")
        }
        val stream = if (status < 400) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
        val json = try {
            JSONObject(text)
        } catch (e: Exception) {
            throw ApiException("Server returned $status: ${text.take(200)}")
        }
        if (status >= 400) throw ApiException(json.optString("error", "Server returned $status"))
        return json
    }

    private fun JSONObject.optStringOrNull(key: String): String? = if (has(key) && !isNull(key)) getString(key) else null

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
