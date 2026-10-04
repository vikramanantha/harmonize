package com.mhacks.blechat.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mhacks.blechat.Api
import com.mhacks.blechat.BuildConfig

/**
 * Sign in: Muse email/mobile + phone number, then the code Muse sends. The
 * server does the Muse work (lib/muse-session.ts) and returns a device token.
 */
@Composable
fun SignInScreen(devMode: Boolean, onDevModeChange: (Boolean) -> Unit, onSignedIn: (String) -> Unit) {
    val context = LocalContext.current
    var step by rememberSaveable { mutableStateOf("start") } // start | code | password
    var server by rememberSaveable { mutableStateOf(Api.serverUrl(context).ifEmpty { BuildConfig.SERVER_URL }) }
    var identifier by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var textMe by rememberSaveable { mutableStateOf(false) }
    var autoApprove by rememberSaveable { mutableStateOf(false) }
    var useDms by rememberSaveable { mutableStateOf(false) }
    var credential by rememberSaveable { mutableStateOf("") }
    var loginId by rememberSaveable { mutableStateOf<String?>(null) }
    var busy by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    var status by rememberSaveable { mutableStateOf<String?>(null) }

    fun fail(raw: String, friendlyAlready: Boolean = false) {
        busy = false
        status = null
        error = if (devMode || friendlyAlready) raw else Friendly.error(raw)
    }

    fun start() {
        error = null
        if (!server.trim().startsWith("http")) return fail("Enter the server URL in developer mode.", friendlyAlready = devMode)
        if (identifier.isBlank()) return fail("Enter the email or phone number you use for Muse.", friendlyAlready = true)
        if (phone.count { it.isDigit() } < 10) return fail("Enter your 10-digit phone number.", friendlyAlready = true)
        Api.setServerUrl(context, server)
        busy = true
        status = "Opening Muse…"
        Api.async({ Api.loginStart(context, identifier.trim(), phone.trim(), textMe, autoApprove, useDms) }, { fail(it) }) { result ->
            busy = false
            status = null
            if (result.deviceToken != null) return@async onSignedIn(result.deviceToken)
            loginId = result.loginId
            credential = ""
            step = result.step
        }
    }

    fun verify() {
        error = null
        val id = loginId ?: run { step = "start"; return }
        if (credential.isBlank()) return fail(if (step == "phone") "Enter your phone number." else "Enter the code Muse sent you.", friendlyAlready = true)
        busy = true
        status = if (step == "phone") "Sending your number to Muse…" else "Checking your code…"
        Api.async({ Api.loginVerify(context, id, credential.trim()) }, { fail(it) }) { result ->
            busy = false
            status = null
            if (result.deviceToken != null) return@async onSignedIn(result.deviceToken)
            credential = ""
            step = result.step
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .imePadding(),
    ) {
        // Hero
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(bottomStart = 36.dp, bottomEnd = 36.dp))
                .background(BrandGradient)
                .statusBarsPadding()
                .padding(start = 28.dp, end = 28.dp, top = 36.dp, bottom = 64.dp),
        ) {
            Column {
                Logo(56.dp, onGradient = true)
                Spacer(Modifier.height(18.dp))
                Text("Harmonize", style = MaterialTheme.typography.displaySmall, color = Color.White)
                Spacer(Modifier.height(6.dp))
                Text(
                    "Meet people nearby who watch the same reels as you.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color.White.copy(alpha = 0.88f),
                )
            }
        }

        // Form card, overlapping the hero
        Card(Modifier.padding(horizontal = 20.dp).offset(y = (-36).dp)) {
            if (step == "start") {
                Text("Sign in with Muse", style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.height(4.dp))
                Text(
                    "Muse reads your Instagram to learn what you're into. We never see your password.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(20.dp))
                AnimatedVisibility(devMode) {
                    Column {
                        Field("Server URL", server, { server = it }, KeyboardType.Uri, enabled = !busy)
                        Spacer(Modifier.height(12.dp))
                    }
                }
                Field("Muse email or phone", identifier, { identifier = it }, KeyboardType.Email, enabled = !busy)
                Spacer(Modifier.height(12.dp))
                Field("Your phone number", phone, { phone = it }, KeyboardType.Phone, enabled = !busy, supporting = "We'll text you when there's a match nearby")
                Spacer(Modifier.height(16.dp))
                ToggleRow("Text me about matches", textMe, enabled = !busy) { textMe = it }
                Row(verticalAlignment = Alignment.Top, modifier = Modifier.padding(top = 4.dp)) {
                    Checkbox(checked = autoApprove, onCheckedChange = { autoApprove = it }, enabled = !busy)
                    Text(
                        "Let Harmonize approve Muse's access to our server for me (we'll tap \"Always allow\" for our site only)",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                }
                Row(verticalAlignment = Alignment.Top) {
                    Checkbox(checked = useDms, onCheckedChange = { useDms = it }, enabled = !busy)
                    Text(
                        "Optional: include reels shared in my Instagram messages. Muse turns on Instagram messages access (always allowed) and looks only at the reels, never your conversations.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                }
                Spacer(Modifier.height(20.dp))
                // Both are required: texts deliver matches, and the approval lets the
                // server finish Muse's setup. The server enforces this too.
                val ready = textMe && autoApprove
                if (!ready) {
                    Text(
                        "Turn on both options above to continue.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
                    )
                }
                GradientButton("Continue", busy, enabled = ready) { start() }
            } else {
                val (title, subtitle) = when (step) {
                    "password" -> "Enter your Muse password" to "Muse is asking for your password."
                    "sms_code" -> "Enter the code we texted you" to "Your Muse account uses two-step sign-in. Enter the code texted to your phone."
                    "phone" -> "Confirm your phone number" to "For two-step sign-in, Muse needs the phone number on your Muse account."
                    else -> "Check your messages" to "Muse sent a code to $identifier."
                }
                Text(title, style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.height(4.dp))
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(20.dp))
                OutlinedTextField(
                    value = credential,
                    onValueChange = { credential = it },
                    enabled = !busy,
                    singleLine = true,
                    placeholder = {
                        Text(
                            when (step) { "password" -> "Password"; "phone" -> "555 123 4567"; else -> "••••••" },
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    },
                    textStyle = if (step == "password" || step == "phone") MaterialTheme.typography.bodyLarge.copy(textAlign = TextAlign.Center)
                    else TextStyle(fontSize = 26.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 8.sp, textAlign = TextAlign.Center),
                    visualTransformation = if (step == "password") PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = when (step) { "password" -> KeyboardType.Password; "phone" -> KeyboardType.Phone; else -> KeyboardType.Number },
                    ),
                    shape = MaterialTheme.shapes.small,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(20.dp))
                GradientButton(if (step == "phone") "Send me the code" else "Verify", busy) { verify() }
                TextButton(
                    onClick = { step = "start"; loginId = null; credential = ""; error = null },
                    enabled = !busy,
                    modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 6.dp),
                ) { Text("Use a different account") }
            }

            AnimatedVisibility(status != null) {
                Text(
                    status.orEmpty(),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
                )
            }
            AnimatedVisibility(error != null) {
                MessageCard(error.orEmpty(), isError = true, modifier = Modifier.padding(top = 16.dp), mono = devMode)
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 32.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Text("Developer mode", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.width(12.dp))
            Switch(checked = devMode, onCheckedChange = onDevModeChange)
        }
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun Field(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    type: KeyboardType,
    enabled: Boolean,
    supporting: String? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        enabled = enabled,
        keyboardOptions = KeyboardOptions(keyboardType = type),
        supportingText = supporting?.let { { Text(it) } },
        shape = MaterialTheme.shapes.small,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
fun ToggleRow(label: String, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange, enabled = enabled)
    }
}
