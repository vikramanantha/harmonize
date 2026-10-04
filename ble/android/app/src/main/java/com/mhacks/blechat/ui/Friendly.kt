package com.mhacks.blechat.ui

/**
 * Turns server and network errors into short messages for people who aren't
 * developers. With developer mode on, the screens show the raw text instead.
 * Keep in sync with ios/BleChat/Friendly.swift.
 */
object Friendly {
    fun error(raw: String): String {
        val text = raw.lowercase()
        return when {
            "can't reach" in text || "unable to resolve" in text || "failed to connect" in text || "timeout" in text && "locator" !in text ->
                "Can't connect to Harmonize right now. Check your internet connection and try again."
            "no server url" in text ->
                "This build of Harmonize isn't connected to a server. Turn on developer mode to set one."
            "didn't accept that code" in text || "verification code" in text && "digit" !in text ->
                "That code didn't work. Check it and try again."
            "digit verification code" in text -> raw
            "expired" in text ->
                "That sign-in took too long. Please start again."
            "slots are busy" in text || "already running" in text ->
                "Harmonize is busy right now. Try again in a minute."
            "supported login step" in text || "captcha" in text ->
                "Muse asked for an extra step we can't do here. Sign in once in the Muse app, then try again."
            "without asking for a code" in text ->
                "Muse didn't send a code. Try again in a moment."
            "not logged in" in text ->
                "You've been signed out. Please sign in again."
            "already belongs to another account" in text ->
                "That Instagram account is already used by another Harmonize sign-in."
            else -> "Something went wrong on our side. Please try again in a moment."
        }
    }

    /** Why the profile couldn't be set up, for the home screen. */
    fun profileError(raw: String?): String {
        val text = raw.orEmpty().lowercase()
        return when {
            "did not report back" in text ->
                "Muse didn't finish reading your Instagram. Open the Muse app to see what happened, then sign in again."
            "no longer logged in" in text || "log in again" in text ->
                "Your Muse sign-in expired. Please sign in again."
            "no taste_profile" in text ->
                "Muse couldn't save your profile. Please sign in again."
            else -> "We couldn't set up your profile. Please sign in again to retry."
        }
    }
}
