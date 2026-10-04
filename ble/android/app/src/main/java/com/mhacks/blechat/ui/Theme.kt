package com.mhacks.blechat.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Harmonize brand: violet into pink, like two tastes blending. */
val Violet = Color(0xFF6D4AFF)
val Pink = Color(0xFFFF5CA8)
val BrandGradient = Brush.linearGradient(listOf(Violet, Pink))

private val LightColors = lightColorScheme(
    primary = Violet,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFEDE7FF),
    onPrimaryContainer = Color(0xFF22106E),
    secondary = Pink,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFFFE3F0),
    onSecondaryContainer = Color(0xFF4A0A2A),
    background = Color(0xFFF7F5FC),
    onBackground = Color(0xFF1B1A21),
    surface = Color.White,
    onSurface = Color(0xFF1B1A21),
    surfaceVariant = Color(0xFFF0ECF7),
    onSurfaceVariant = Color(0xFF615C6E),
    outline = Color(0xFFDCD5E6),
    outlineVariant = Color(0xFFEAE5F1),
    error = Color(0xFFD2335A),
    errorContainer = Color(0xFFFFE6EC),
    onErrorContainer = Color(0xFF5E0B21),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFB9A8FF),
    onPrimary = Color(0xFF2B1290),
    primaryContainer = Color(0xFF3A2A8F),
    onPrimaryContainer = Color(0xFFEDE7FF),
    secondary = Color(0xFFFF8DC2),
    onSecondary = Color(0xFF5A0E35),
    secondaryContainer = Color(0xFF6E1E46),
    onSecondaryContainer = Color(0xFFFFE3F0),
    background = Color(0xFF111016),
    onBackground = Color(0xFFE8E4EF),
    surface = Color(0xFF1B1A22),
    onSurface = Color(0xFFE8E4EF),
    surfaceVariant = Color(0xFF26242F),
    onSurfaceVariant = Color(0xFFC8C2D3),
    outline = Color(0xFF3B3846),
    outlineVariant = Color(0xFF2E2C37),
    error = Color(0xFFFF8BA3),
    errorContainer = Color(0xFF4C1123),
    onErrorContainer = Color(0xFFFFD9E1),
)

private val AppTypography = Typography(
    displaySmall = TextStyle(fontSize = 34.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp),
    headlineSmall = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.2).sp),
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
    labelMedium = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.4.sp),
)

@Composable
fun HarmonizeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        typography = AppTypography,
        shapes = Shapes(
            small = RoundedCornerShape(12.dp),
            medium = RoundedCornerShape(18.dp),
            large = RoundedCornerShape(26.dp),
        ),
        content = content,
    )
}

/** The mark from the app icon: two overlapping circles. */
@Composable
fun Logo(size: Dp, modifier: Modifier = Modifier, onGradient: Boolean = false) {
    Canvas(modifier.size(size)) {
        val r = this.size.minDimension * 0.30f
        val y = this.size.height / 2
        val left = Offset(this.size.width / 2 - r * 0.55f, y)
        val right = Offset(this.size.width / 2 + r * 0.55f, y)
        if (onGradient) {
            drawCircle(Color.White.copy(alpha = 0.95f), r, left)
            drawCircle(Color.White.copy(alpha = 0.6f), r, right)
        } else {
            drawCircle(Violet, r, left)
            drawCircle(Pink.copy(alpha = 0.8f), r, right)
        }
    }
}
