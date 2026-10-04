package com.mhacks.blechat.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Full-width gradient button with a spinner while [busy]. */
@Composable
fun GradientButton(text: String, busy: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    val active = enabled && !busy
    Surface(
        onClick = onClick,
        enabled = active,
        shape = RoundedCornerShape(16.dp),
        color = Color.Transparent,
        modifier = Modifier.fillMaxWidth().height(54.dp),
    ) {
        Box(
            Modifier
                .background(BrandGradient)
                .alpha(if (active || busy) 1f else 0.5f),
            contentAlignment = Alignment.Center,
        ) {
            if (busy) {
                CircularProgressIndicator(Modifier.size(22.dp), color = Color.White, strokeWidth = 2.5.dp)
            } else {
                Text(text, color = Color.White, style = MaterialTheme.typography.labelLarge)
            }
        }
    }
}

/** A friendly message card; red for problems, violet for information. */
@Composable
fun MessageCard(text: String, isError: Boolean, modifier: Modifier = Modifier, mono: Boolean = false) {
    val colors = MaterialTheme.colorScheme
    Surface(
        color = if (isError) colors.errorContainer else colors.primaryContainer,
        contentColor = if (isError) colors.onErrorContainer else colors.onPrimaryContainer,
        shape = MaterialTheme.shapes.medium,
        modifier = modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
            Icon(
                if (isError) Icons.Filled.Warning else Icons.Filled.Info,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(12.dp))
            Text(
                text,
                style = if (mono) MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                else MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

/** Section title like "Nearby · 2". */
@Composable
fun SectionTitle(title: String, trailing: String? = null) {
    Row(
        Modifier.fillMaxWidth().padding(top = 24.dp, bottom = 10.dp, start = 4.dp, end = 4.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(title, style = MaterialTheme.typography.titleLarge)
        if (trailing != null) Text(trailing, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** Round avatar showing the first letter of a name, on the brand gradient. */
@Composable
fun Avatar(name: String, size: Dp, brush: Brush = BrandGradient) {
    Box(
        Modifier.size(size).clip(CircleShape).background(brush),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            name.trimStart('@').take(1).uppercase(),
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = (size.value * 0.42f).sp,
        )
    }
}

/** A softly pulsing dot for "live" status. */
@Composable
fun LiveDot(color: Color) {
    val pulse by rememberInfiniteTransition(label = "live").animateFloat(
        initialValue = 0.6f,
        targetValue = 1.4f,
        animationSpec = infiniteRepeatable(tween(1100), RepeatMode.Reverse),
        label = "pulse",
    )
    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(14.dp)) {
        Box(Modifier.size(14.dp).scale(pulse).alpha(0.25f).clip(CircleShape).background(color))
        Box(Modifier.size(8.dp).clip(CircleShape).background(color))
    }
}

/** Compatibility score as a ring with the percentage inside. */
@Composable
fun ScoreRing(score: Double, size: Dp = 56.dp, highlight: Boolean) {
    val colors = MaterialTheme.colorScheme
    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(size)) {
        CircularProgressIndicator(
            progress = { score.toFloat().coerceIn(0f, 1f) },
            modifier = Modifier.size(size),
            color = if (highlight) colors.secondary else colors.primary,
            trackColor = colors.surfaceVariant,
            strokeWidth = 5.dp,
            strokeCap = StrokeCap.Round,
        )
        Text("${(score * 100).toInt()}%", style = MaterialTheme.typography.labelLarge)
    }
}

/** Three signal bars from a Bluetooth RSSI. */
@Composable
fun SignalBars(rssi: Int) {
    val level = when {
        rssi >= -60 -> 3
        rssi >= -75 -> 2
        else -> 1
    }
    val colors = MaterialTheme.colorScheme
    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        for (bar in 1..3) {
            Box(
                Modifier
                    .width(5.dp)
                    .height((6 + bar * 5).dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(if (bar <= level) colors.primary else colors.outline),
            )
        }
    }
}

@Composable
fun Pill(text: String, container: Color, content: Color) {
    Surface(color = container, contentColor = content, shape = CircleShape) {
        Text(text, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
    }
}

@Composable
fun Card(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.large,
        shadowElevation = 1.dp,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp)) { content() }
    }
}
