package com.mhacks.blechat.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mhacks.blechat.Api
import com.mhacks.blechat.Peer

/** Everything the home screen shows; owned by MainActivity. */
class HomeState {
    var me by mutableStateOf<Api.Me?>(null)
    var serverError by mutableStateOf<String?>(null)
    var peers by mutableStateOf<List<Peer>>(emptyList())
    var log by mutableStateOf<List<String>>(emptyList())
    var bluetoothOn by mutableStateOf(false)
    var bluetoothProblem by mutableStateOf<String?>(null)
}

@Composable
fun HomeScreen(
    state: HomeState,
    devMode: Boolean,
    serverUrl: String,
    onDevModeChange: (Boolean) -> Unit,
    onSignOut: () -> Unit,
) {
    val me = state.me
    val colors = MaterialTheme.colorScheme
    LazyColumn(
        Modifier.fillMaxSize().background(colors.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp),
    ) {
        item {
            TopBar(devMode, onDevModeChange, onSignOut)
        }
        item { ProfileCard(state) }

        // Problems and setup state, most important first.
        if (state.serverError != null) {
            item {
                MessageCard(
                    if (devMode) "Server: ${state.serverError}" else Friendly.error(state.serverError.orEmpty()),
                    isError = true,
                    modifier = Modifier.padding(top = 16.dp),
                    mono = devMode,
                )
            }
        }
        when (me?.profileStatus) {
            "pending" -> item { SettingUpCard() }
            "error" -> item {
                Column(Modifier.padding(top = 16.dp)) {
                    MessageCard(
                        if (devMode) me.profileError.orEmpty() else Friendly.profileError(me.profileError),
                        isError = true,
                        mono = devMode,
                    )
                    Spacer(Modifier.height(12.dp))
                    GradientButton("Sign in again", busy = false) { onSignOut() }
                }
            }
        }
        if (me?.profileStatus == "ready") {
            state.bluetoothProblem?.let { problem ->
                item { MessageCard(problem, isError = true, modifier = Modifier.padding(top = 16.dp)) }
            }
            if (me.done) {
                item {
                    MessageCard(
                        "You've been matched! We texted you both, so go say hi.",
                        isError = false,
                        modifier = Modifier.padding(top = 16.dp),
                    )
                }
            }
            if (devMode && me.refreshError != null) {
                item { MessageCard("Daily refresh failed: ${me.refreshError}", isError = true, modifier = Modifier.padding(top = 16.dp), mono = true) }
            }

            item { SectionTitle("Nearby", if (state.peers.isEmpty()) null else "${state.peers.size}") }
            if (state.peers.isEmpty()) {
                item { EmptyCard("No one nearby yet", "Keep Harmonize running. We'll find people around you who are on Harmonize too.") }
            } else {
                item {
                    Card {
                        state.peers.forEachIndexed { i, peer ->
                            if (i > 0) HorizontalDivider(Modifier.padding(vertical = 12.dp), color = colors.outlineVariant)
                            PeerRow(peer)
                        }
                    }
                }
            }

            item { SectionTitle("Matches", me.matches.size.takeIf { it > 0 }?.toString()) }
            if (me.matches.isEmpty()) {
                item { EmptyCard("No matches yet", "When someone who watches the same kind of reels is nearby, they'll show up here.") }
            } else {
                items(me.matches, key = { it.otherUsername }) { match ->
                    MatchCard(match, Modifier.padding(bottom = 12.dp))
                }
            }
        }

        if (devMode) {
            item { SectionTitle("Developer") }
            item {
                Card {
                    DevLine("Server", serverUrl)
                    DevLine("Bluetooth", if (state.bluetoothOn) "running" else "stopped")
                    me?.let {
                        DevLine("Profile", it.profileStatus)
                        DevLine("Match threshold", "${(it.threshold * 100).toInt()}%")
                        DevLine("LOOP", it.loop.toString())
                    }
                }
            }
            item { SectionTitle("Log") }
            item {
                Card {
                    if (state.log.isEmpty()) {
                        Text("Nothing yet", color = colors.onSurfaceVariant)
                    }
                    state.log.forEach { line ->
                        Text(
                            line,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            lineHeight = 15.sp,
                            modifier = Modifier.padding(vertical = 3.dp),
                        )
                    }
                }
            }
        }
        item { Spacer(Modifier.navigationBarsPadding()) }
    }
}

@Composable
private fun TopBar(devMode: Boolean, onDevModeChange: (Boolean) -> Unit, onSignOut: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    Row(
        Modifier.fillMaxWidth().statusBarsPadding().padding(top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Logo(32.dp)
        Spacer(Modifier.width(8.dp))
        Text("Harmonize", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
        Box {
            IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, contentDescription = "Menu") }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                DropdownMenuItem(
                    text = { Text("Developer mode") },
                    trailingIcon = { Switch(checked = devMode, onCheckedChange = null) },
                    onClick = { onDevModeChange(!devMode) },
                )
                DropdownMenuItem(text = { Text("Sign out") }, onClick = { menu = false; onSignOut() })
            }
        }
    }
}

@Composable
private fun ProfileCard(state: HomeState) {
    val me = state.me
    val ready = me?.profileStatus == "ready"
    Box(
        Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.large)
            .background(BrandGradient)
            .padding(22.dp),
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(56.dp).clip(RoundedCornerShape(50)).background(Color.White.copy(alpha = 0.22f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        (me?.name ?: me?.username ?: "?").take(1).uppercase(),
                        color = Color.White,
                        style = MaterialTheme.typography.headlineSmall,
                    )
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        me?.name ?: if (me == null) "Loading…" else "Setting up",
                        color = Color.White,
                        style = MaterialTheme.typography.titleLarge,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    me?.username?.let {
                        Text("@$it", color = Color.White.copy(alpha = 0.85f), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            Surface(color = Color.White.copy(alpha = 0.18f), contentColor = Color.White, shape = RoundedCornerShape(50)) {
                Row(Modifier.padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    when {
                        ready && state.bluetoothOn && me?.done != true -> {
                            LiveDot(Color.White)
                            Spacer(Modifier.width(8.dp))
                            Text("Looking for people nearby", style = MaterialTheme.typography.labelMedium)
                        }
                        ready && me?.done == true -> Text("Matched, paused", style = MaterialTheme.typography.labelMedium)
                        ready -> Text("Bluetooth is off", style = MaterialTheme.typography.labelMedium)
                        me?.profileStatus == "error" -> Text("Needs attention", style = MaterialTheme.typography.labelMedium)
                        else -> Text("Getting your profile ready", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingUpCard() {
    Card(Modifier.padding(top = 16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 3.dp)
            Spacer(Modifier.width(16.dp))
            Column {
                Text("Muse is reading your Instagram", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(2.dp))
                Text(
                    "This takes a few minutes. You can leave the app; we'll start finding people as soon as it's done.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun EmptyCard(title: String, body: String) {
    Card {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(4.dp))
        Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun PeerRow(peer: Peer) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Avatar(peer.username, 40.dp)
        Spacer(Modifier.width(12.dp))
        Text("@${peer.username}", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
        SignalBars(peer.rssi)
    }
}

@Composable
private fun MatchCard(match: Api.Match, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    Card(modifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            ScoreRing(match.score, highlight = match.matched)
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    match.otherName ?: "@${match.otherUsername}",
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (match.otherName != null) {
                    Text("@${match.otherUsername}", style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
                }
                Spacer(Modifier.height(6.dp))
                Text(match.verdict, style = MaterialTheme.typography.bodyMedium)
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            when {
                match.notifiedAt != null -> Pill("Texted you both", colors.secondaryContainer, colors.onSecondaryContainer)
                match.notifyError != null -> Pill("Couldn't send the text", colors.errorContainer, colors.onErrorContainer)
                match.matched -> Pill("It's a match", colors.primaryContainer, colors.onPrimaryContainer)
                else -> Pill("Different tastes", colors.surfaceVariant, colors.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun DevLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(130.dp))
        Text(value, style = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace), modifier = Modifier.weight(1f))
    }
}
