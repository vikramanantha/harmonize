# BleChat setup

How to install BleChat on an Android phone and an iPhone and check that they find each other over Bluetooth (Method 2).

- Android app: `ble/android`
- iPhone app: `ble/ios`
- How Method 2 works, and what does and doesn't work when an app is in the background: see the header of `ble/android/app/src/main/java/com/mhacks/blechat/Method2Gatt.kt`.

## What you need

- A Mac with Homebrew and Android Studio, both already installed on this one.
- **Xcode** from the Mac App Store, for the iPhone. It's about 10+ GB. Open it once after installing to accept the license and install the extra components.
- An Apple ID. A free one works.
- USB cables for both phones.

## Android phone

1. **Turn on USB debugging:** Settings → About phone → tap **Build number** 7 times. Then Settings → System → Developer options → turn on **USB debugging**.
2. **Plug it into the Mac** and tap **Allow** on the prompt that appears on the phone.
3. **Install:**
   ```bash
   cd ~/Documents/vikramanantha.github.io/mhacks26/ble/android
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   ~/Library/Android/sdk/platform-tools/adb devices   # your phone should be listed
   ./gradlew installDebug
   ```
   Or open `mhacks26/ble/android` in Android Studio, pick your phone and press ▶ Run.
4. **Open BleChat** and allow **Nearby devices** and **Notifications**. Make sure Bluetooth is on.
5. **Let it run in the background:** Settings → Apps → BleChat → Battery → **Unrestricted**. Samsung, Xiaomi and similar phones kill background apps without this.

## iPhone

1. **Generate the Xcode project:**
   ```bash
   brew install xcodegen
   cd ~/Documents/vikramanantha.github.io/mhacks26/ble/ios
   xcodegen
   open BleChat.xcodeproj
   ```
2. **Set up signing:** Xcode → Settings → Accounts → **+** → add your Apple ID. Then click **BleChat** in the left sidebar → **Signing & Capabilities**:
   - **Team:** your Apple ID.
   - **Bundle Identifier:** something unique, e.g. `com.vikram.blechat`.
3. **Prepare the iPhone:** plug it in and tap **Trust This Computer**. Then Settings → Privacy & Security → **Developer Mode** → On (the phone restarts).
4. **Run it:** pick the iPhone in Xcode's device dropdown at the top and press **▶** (⌘R).
5. **Trust yourself as the developer:** the first launch is blocked as "Untrusted Developer". On the iPhone, go to Settings → General → **VPN & Device Management** → your Apple ID → **Trust**. Press ▶ again and allow Bluetooth.

With a free Apple ID, the app stops opening after 7 days. Plug the phone back in and press ▶ to reinstall.

**No XcodeGen?** File → New → Project → iOS App named "BleChat" (SwiftUI). Delete the `ContentView.swift` and `BleChatApp.swift` that Xcode creates, then drag in every `.swift` file from `ble/ios/BleChat`. In the target's **Info** tab, add "Privacy - Bluetooth Always Usage Description". Add the **Background Modes** capability and tick "Uses Bluetooth LE accessories" and "Acts as a Bluetooth LE accessory".

## Test

1. On both phones, type a username (up to 30 characters, Instagram's limit) and tap **2: GATT**. The iPhone has to be unlocked with the app open for this step, because iOS only lets an app start broadcasting in the foreground. BleChat remembers the choice and turns it back on next launch.
2. Within a few seconds, each phone's log should show `read "<other username>"`.
3. **Lock the iPhone.** Within about 30 s, the Android log should print the iPhone's name again, marked `(GATT (iPhone overflow area))`. This line means the overflow trick works on this iPhone.
4. To watch the Android output from the Mac:
   ```bash
   ~/Library/Android/sdk/platform-tools/adb logcat -s BleChat
   ```
   The iPhone's output shows in Xcode's console while it's plugged in.

## What to expect

| Situation | Result |
|---|---|
| Both apps open | Both see each other within a few seconds |
| iPhone app in the background or locked | Both still see each other: Android via the overflow area, the iPhone more slowly |
| Android app closed or screen off | Still works: a background service runs behind a "BleChat is finding people nearby" notification |
| iPhone app swiped away (force-quit) | Nothing works until it's opened again |
| Two iPhones, both in the background | Usually don't see each other: an iPhone only reads another's overflow area while its own screen is on |

## Troubleshooting

- **`adb devices` shows nothing or "unauthorized":** replug the cable, unlock the phone and tap **Allow**. Some cables only charge, so try another.
- **Gradle says it can't find Java:** run the `export JAVA_HOME=…` line again in the same terminal.
- **Xcode signing error about the bundle ID:** change the Bundle Identifier to something nobody else has used.
- **"status 133" or "timed out" in the log:** normal Bluetooth flakiness. The app retries after 5 s. If it never connects, turn Bluetooth off and on again on both phones.
- **Android never shows "(iPhone overflow area)":** check that the iPhone was switched to 2: GATT while the app was open, and that the app wasn't force-quit. Other Bluetooth apps on the iPhone can also interfere. The overflow area is undocumented, so a new iOS version may also have changed it.
