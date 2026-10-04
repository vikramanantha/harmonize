import Foundation

/// Turns server and network errors into short messages for people who aren't
/// developers. With developer mode on, the screens show the raw text instead.
/// Keep in sync with android/.../ui/Friendly.kt.
enum Friendly {
    static func error(_ raw: String) -> String {
        let text = raw.lowercased()
        func has(_ s: String) -> Bool { text.contains(s) }
        if has("can't reach") || has("could not connect") || has("offline") || (has("timed out") && !has("locator")) {
            return "Can't connect to Harmonize right now. Check your internet connection and try again."
        }
        if has("no server url") { return "This build of Harmonize isn't connected to a server. Turn on developer mode to set one." }
        if has("digit verification code") || has("didn't accept that phone number") { return raw }
        if has("doesn't recognize") {
            return "Muse asked for a sign-in step Harmonize can't handle yet. Turn on developer mode to see what it showed."
        }
        if has("didn't accept that code") || has("verification code") { return "That code didn't work. Check it and try again." }
        if has("expired") { return "That sign-in took too long. Please start again." }
        if has("slots are busy") || has("already running") { return "Harmonize is busy right now. Try again in a minute." }
        if has("supported login step") || has("captcha") {
            return "Muse asked for an extra step we can't do here. Sign in once in the Muse app, then try again."
        }
        if has("without asking for a code") { return "Muse didn't send a code. Try again in a moment." }
        if has("not logged in") { return "You've been signed out. Please sign in again." }
        if has("already belongs to another account") { return "That Instagram account is already used by another Harmonize sign-in." }
        return "Something went wrong on our side. Please try again in a moment."
    }

    /// Why the profile couldn't be set up, for the home screen.
    static func profileError(_ raw: String?) -> String {
        let text = (raw ?? "").lowercased()
        if text.contains("did not report back") {
            return "Muse didn't finish reading your Instagram. Open the Muse app to see what happened, then sign in again."
        }
        if text.contains("no longer logged in") || text.contains("log in again") { return "Your Muse sign-in expired. Please sign in again." }
        if text.contains("no taste_profile") { return "Muse couldn't save your profile. Please sign in again." }
        return "We couldn't set up your profile. Please sign in again to retry."
    }
}
