plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

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
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

// No dependencies: plain android.app.Activity + framework Bluetooth APIs only.
