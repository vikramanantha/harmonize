package com.mhacks.blechat

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView

/**
 * First run: log in to Muse (email/mobile + the code Muse sends), give a phone
 * number for match texts, then wait while Muse reads Instagram and reports back.
 * Three steps on one screen; the server does the work (lib/muse-session.ts).
 */
class OnboardingActivity : Activity() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var serverInput: EditText
    private lateinit var identifierInput: EditText
    private lateinit var phoneInput: EditText
    private lateinit var consentSwitch: Switch
    private lateinit var autoApproveBox: CheckBox
    private lateinit var codeInput: EditText
    private lateinit var codeLabel: TextView
    private lateinit var status: TextView
    private lateinit var primary: Button
    private lateinit var secondary: Button
    private lateinit var stepOne: LinearLayout
    private lateinit var stepTwo: LinearLayout

    private var loginId: String? = null
    private var busy = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildUi())
        if (Api.isLoggedIn(this)) showWaiting() else showStepOne()
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
    }

    // ---- Step 1: Muse account + phone number ------------------------------

    private fun showStepOne() {
        stepOne.visibility = View.VISIBLE
        stepTwo.visibility = View.GONE
        primary.text = "Continue with Muse"
        primary.setOnClickListener { startLogin() }
        secondary.visibility = View.GONE
        setStatus("")
    }

    private fun startLogin() {
        val server = serverInput.text.toString().trim()
        val identifier = identifierInput.text.toString().trim()
        val phone = phoneInput.text.toString().trim()
        if (!server.startsWith("http")) return setStatus("Enter the server URL, e.g. https://xyz.ngrok.app", error = true)
        if (identifier.isEmpty()) return setStatus("Enter the email or mobile number of your Muse account", error = true)
        if (phone.count { it.isDigit() } < 10) return setStatus("Enter your 10-digit US phone number", error = true)
        Api.setServerUrl(this, server)
        setBusy(true, "Opening Muse in a remote browser…")
        Api.async({ Api.loginStart(this, identifier, phone, consentSwitch.isChecked, autoApproveBox.isChecked) }, ::fail) { step ->
            setBusy(false, "")
            if (step.deviceToken != null) return@async loggedIn(step.deviceToken)
            loginId = step.loginId
            showStepTwo(step.step)
        }
    }

    // ---- Step 2: verification code ----------------------------------------

    private fun showStepTwo(step: String) {
        stepOne.visibility = View.GONE
        stepTwo.visibility = View.VISIBLE
        codeLabel.text = if (step == "password") "Muse password" else "Verification code Muse sent you"
        codeInput.inputType = if (step == "password") {
            InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        } else {
            InputType.TYPE_CLASS_NUMBER
        }
        codeInput.setText("")
        primary.text = "Verify"
        primary.setOnClickListener { verify() }
        secondary.visibility = View.VISIBLE
        secondary.text = "Start over"
        secondary.setOnClickListener { showStepOne() }
        setStatus("")
    }

    private fun verify() {
        val id = loginId ?: return showStepOne()
        val credential = codeInput.text.toString().trim()
        if (credential.isEmpty()) return setStatus("Enter the code", error = true)
        setBusy(true, "Verifying and sending Muse its instructions…")
        Api.async({ Api.loginVerify(this, id, credential) }, ::fail) { step ->
            setBusy(false, "")
            when {
                step.deviceToken != null -> loggedIn(step.deviceToken)
                else -> showStepTwo(step.step)
            }
        }
    }

    private fun loggedIn(token: String) {
        Api.setToken(this, token)
        showWaiting()
    }

    // ---- Step 3: wait for Muse to report the Instagram summary ------------

    private fun showWaiting() {
        stepOne.visibility = View.GONE
        stepTwo.visibility = View.GONE
        primary.visibility = View.GONE
        secondary.visibility = View.VISIBLE
        secondary.text = "Log out"
        secondary.setOnClickListener { logout() }
        setStatus("Muse is reading your Instagram and saving your taste profile. This can take a few minutes…")
        handler.post(poll)
    }

    private val poll = object : Runnable {
        override fun run() {
            Api.async({ Api.me(this@OnboardingActivity) }, { message ->
                setStatus("Can't reach the server: $message", error = true)
                handler.postDelayed(this, POLL_MS)
            }) { me ->
                when (me.profileStatus) {
                    "ready" -> {
                        startActivity(Intent(this@OnboardingActivity, MainActivity::class.java))
                        finish()
                    }
                    "error" -> {
                        setStatus("Muse failed: ${me.profileError}", error = true)
                        primary.visibility = View.VISIBLE
                        primary.text = "Log in again"
                        primary.setOnClickListener { logout() }
                    }
                    else -> handler.postDelayed(this, POLL_MS)
                }
            }
        }
    }

    private fun logout() {
        handler.removeCallbacks(poll)
        Api.setToken(this, null)
        primary.visibility = View.VISIBLE
        showStepOne()
    }

    // ---- Helpers ----------------------------------------------------------

    private fun fail(message: String) {
        setBusy(false, message, error = true)
    }

    private fun setBusy(value: Boolean, message: String, error: Boolean = false) {
        busy = value
        primary.isEnabled = !value
        secondary.isEnabled = !value
        setStatus(message, error)
    }

    private fun setStatus(message: String, error: Boolean = false) {
        status.text = message
        status.setTextColor(if (error) 0xFFB00020.toInt() else 0xFF444444.toInt())
    }

    private fun buildUi(): View {
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(32), dp(20), dp(20))
        }
        column.addView(text("Harmony", 26f).apply { setTypeface(typeface, Typeface.BOLD) })
        column.addView(text("Find people nearby who watch the same reels.", 15f).apply { alpha = 0.7f })

        stepOne = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        stepOne.addView(header("Server URL"))
        serverInput = EditText(this).apply {
            setText(Api.serverUrl(this@OnboardingActivity).ifEmpty { BuildConfig.SERVER_URL })
            hint = "https://xyz.ngrok.app"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine()
        }
        stepOne.addView(serverInput)
        stepOne.addView(header("Muse account email or mobile"))
        identifierInput = EditText(this).apply {
            hint = "you@example.com"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            setSingleLine()
        }
        stepOne.addView(identifierInput)
        stepOne.addView(header("Your US phone number (for match texts)"))
        phoneInput = EditText(this).apply {
            hint = "555 123 4567"
            inputType = InputType.TYPE_CLASS_PHONE
            setSingleLine()
        }
        stepOne.addView(phoneInput)
        consentSwitch = Switch(this).apply {
            text = "Text me when someone nearby is a match"
            isChecked = true
            setPadding(0, dp(16), 0, 0)
        }
        stepOne.addView(consentSwitch)
        autoApproveBox = CheckBox(this).apply {
            text = "Approve Muse's access to the Harmony server for me. Harmony will tap \"Always allow this site\" " +
                "on Muse's prompt for the server URL above (and no other site)."
            setPadding(0, dp(12), 0, 0)
        }
        stepOne.addView(autoApproveBox)
        column.addView(stepOne)

        stepTwo = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; visibility = View.GONE }
        codeLabel = header("Verification code")
        stepTwo.addView(codeLabel)
        codeInput = EditText(this).apply { setSingleLine() }
        stepTwo.addView(codeInput)
        column.addView(stepTwo)

        status = text("", 14f).apply { setPadding(0, dp(16), 0, dp(8)) }
        column.addView(status)
        primary = Button(this)
        column.addView(primary)
        secondary = Button(this).apply { visibility = View.GONE }
        column.addView(secondary)
        return ScrollView(this).apply { addView(column) }
    }

    private fun header(label: String) = text(label, 13f).apply {
        setTypeface(typeface, Typeface.BOLD)
        setPadding(0, dp(20), 0, dp(4))
        alpha = 0.7f
    }

    private fun text(value: String, sizeSp: Float) = TextView(this).apply {
        text = value
        textSize = sizeSp
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private companion object {
        const val POLL_MS = 5_000L
    }
}
