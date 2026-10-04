plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Prefills the app's server URL from the repo's .env (SERVER_PUBLIC_URL), so the
// phone and the server agree on the current ngrok URL. Rebuild after changing it.
val serverUrl = rootProject.file("../../.env").takeIf { it.exists() }
    ?.readLines()
    ?.firstOrNull { it.startsWith("SERVER_PUBLIC_URL=") }
    ?.substringAfter("=")?.trim()?.trimEnd('/')
    ?: ""

android {
    namespace = "com.mhacks.blechat"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.mhacks.blechat"
        // Android 12+: the BLUETOOTH_SCAN/ADVERTISE/CONNECT runtime permissions.
        minSdk = 31
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "SERVER_URL", "\"$serverUrl\"")
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

// The UI is Jetpack Compose (Material 3); Bluetooth uses only framework APIs.
dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.04.01"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
}
