# Harmonize setup

Harmonize matches people nearby by what they watch on Instagram Reels. Muse reads each person's Instagram and writes a taste profile to the shared SpacetimeDB; the phones find each other over Bluetooth; the server scores pairs and texts both people through Photon when they match.

```
phone (Android/iOS)  --Bluetooth-->  phone
   |  reports "I'm near @username"
   v
Harmonize server (Next.js, this repo)  --> semantic/service.py (similarity)
   |  login via Browserbase, prompts Muse      --> SpacetimeDB harmony-1o7k0 (taste_profile, match_result)
   |                                           --> Photon (iMessage)
Muse (Meta's cloud) --writes taste_profile, then calls back--> server
```

## 1. Server

Needs Node 22.5+ (built-in SQLite) and Python 3.

```bash
cd mhacks26
npm install
cp .env.example .env     # then fill it in, see below
```

`.env` values you must set:

| Variable | Where it comes from |
|---|---|
| `BROWSERBASE_API_KEY` | Browserbase dashboard → Settings. `BROWSERBASE_PROJECT_ID` is optional; the project is inferred from the key. |
| `SERVER_PUBLIC_URL` | The public URL of this server. Muse calls it back from Meta's cloud, so run `ngrok http 3000` and paste the `https://….ngrok.app` URL. |
| `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET` | Photon dashboard (https://app.photon.codes) → project Settings. |
| `MATCH_THRESHOLD` | Cosine similarity needed for a match. Default 0.8; two clearly similar test profiles scored 0.60, so expect to tune this down (0.6–0.7). |
| `LOOP` | `false`: a phone stops reporting after its first texted match. |

Start the three processes (three terminals):

```bash
# 1. similarity service (first run: python3 -m venv semantic/.venv && semantic/.venv/bin/pip install sentence-transformers)
semantic/run.sh

# 2. public tunnel
ngrok http 3000          # put the https URL in .env as SERVER_PUBLIC_URL

# 3. the server
npm run dev
```

Test Photon before anything else:

```bash
node --env-file=.env scripts/photon-test.mjs +1YOURNUMBER
```

### Testing without Muse

Set `MOCK_MUSE=true` and `NOTIFIER=log` in `.env`. Create a taste profile by hand, then log in with a `mock_username`:

```bash
spacetime call -s maincloud --anonymous harmony-1o7k0 save_taste_profile "Test A" "test_a" "Three sentences about their reels."
curl -X POST localhost:3000/api/app/login/start -H 'Content-Type: application/json' \
  -d '{"identifier":"a@example.com","phone_number":"+15550000001","consent":true,"mock_username":"test_a"}'
```

The phones can't send `mock_username`; use curl for mock accounts, or point the phones at a server with real Muse.

## 2. Android phone

1. Settings → About phone → tap **Build number** 7 times, then Developer options → **USB debugging**. Plug in, tap **Allow**.
2. Install:
   ```bash
   cd mhacks26/ble/android
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   ./gradlew installDebug
   ```
3. Open **Harmonize**. Enter your Muse email or phone and your 10-digit phone number (the server URL is built in; turn on **Developer mode** at the bottom to see or change it). Tap Continue, enter the code Muse sends, then wait while Muse reads your Instagram (a few minutes).
4. Allow **Nearby devices** and **Notifications**. Settings → Apps → Harmonize → Battery → **Unrestricted** so it keeps running in the background.
5. Logs: `~/Library/Android/sdk/platform-tools/adb logcat -s Harmonize`

## 3. iPhone

Needs Xcode and an Apple ID (free is fine; the app expires after 7 days, press Run again).

```bash
brew install xcodegen
cd mhacks26/ble/ios && xcodegen && open BleChat.xcodeproj
```

1. Xcode → Settings → Accounts → add the Apple ID. Target **BleChat** → Signing & Capabilities → pick the Team, set a unique Bundle Identifier (e.g. `com.yourname.harmony`).
2. Plug the iPhone in, tap **Trust**. On the iPhone: Settings → Privacy & Security → **Developer Mode** → On.
3. Pick the iPhone as the run destination, press ▶. First launch: Settings → General → **VPN & Device Management** → trust your Apple ID, press ▶ again.
4. Same onboarding as Android. Bluetooth keeps running in the background once the profile is ready; a force-quit (swipe away) stops it until the app is opened again.

## 4. What happens on a match

1. Each phone reads the other's username over Bluetooth (about every 30 s) and reports it to the server.
2. The server scores the pair once (`match_result` in SpacetimeDB, cached locally) and checks `MATCH_THRESHOLD`.
3. If it's a match **and** both phones reported each other within `PROXIMITY_WINDOW_MS` (10 s) **and** both consented, both get an iMessage with the score, verdict and each other's names. A pair is texted at most once per `ENCOUNTER_COOLDOWN_MS` (1 h).
4. With `LOOP=false`, a phone that has been texted stops reporting.

Both phones show the result of every report in their log (`@name: 72%, MATCH. Waiting for their phone to see you too`, …).

## Muse site approvals

Muse asks before contacting a new website ("Allow Muse to share information with …?"). The prompt only contacts one site, this server's URL, and the server writes the profile to SpacetimeDB itself. So each Muse account taps **Always allow this site** once, the first time, and the daily refresh doesn't ask again. The ngrok free plan gives your account one fixed `*.ngrok-free.dev` domain; keep using it so the approval stays valid.

## Developer mode

Both apps have a **Developer mode** switch (bottom of the sign-in screen, and in the ⋯ menu on the home screen). Off: clean screens and short, friendly error messages. On: the server URL field, a Developer card (server, Bluetooth, profile status, threshold, LOOP), the Bluetooth/matching log, and raw error text.

## Troubleshooting

- **"Muse did not report back within 20 minutes"**: Muse didn't run the callback curl. Open the Muse app: it is probably waiting on the one-time "Allow Muse to share information with <ngrok URL>?" card, or it says what failed. Check `SERVER_PUBLIC_URL` is reachable from the internet.
- **"Muse is no longer logged in"** on the daily refresh: log out and in again on the phone.
- **"Semantic service unreachable"**: start `semantic/run.sh`.
- **Text failed** in the matches list: the Photon error is shown verbatim; run `scripts/photon-test.mjs` to isolate it.
- **Nothing nearby**: see `ble/android/.../Method2Gatt.kt` header for the Bluetooth behaviour table (iPhone force-quit, two iPhones both in background).
