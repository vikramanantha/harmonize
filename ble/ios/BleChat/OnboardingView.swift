import SwiftUI

/// Sign in: Muse email/mobile + phone number, then the code Muse sends. The
/// server does the Muse work (lib/muse-session.ts) and returns a device token.
struct OnboardingView: View {
    @ObservedObject var store: BleStore
    @AppStorage("dev_mode") private var devMode = false
    @State private var serverUrl = Api.serverUrl.isEmpty ? Api.defaultServerUrl : Api.serverUrl
    @State private var identifier = ""
    @State private var phone = ""
    @State private var textMe = false
    @State private var autoApprove = false
    @State private var useDms = false
    @State private var credential = ""
    @State private var loginId: String?
    @State private var step = "start" // start | code | password
    @State private var busy = false
    @State private var status: String?
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                hero
                form
                    .padding(.horizontal, 20)
                    .offset(y: -36)
                devToggle
            }
        }
        .background(Color(.systemGroupedBackground))
        .ignoresSafeArea(edges: .top)
        .scrollDismissesKeyboard(.interactively)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 0) {
            Logo(size: 56, onGradient: true)
            Text("Harmonize")
                .font(.system(size: 34, weight: .bold))
                .foregroundStyle(.white)
                .padding(.top, 18)
            Text("Meet people nearby who watch the same reels as you.")
                .font(.body)
                .foregroundStyle(.white.opacity(0.88))
                .padding(.top, 6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 28)
        .padding(.top, 90)
        .padding(.bottom, 64)
        .background(Brand.gradient)
        .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 36, bottomTrailingRadius: 36, style: .continuous))
    }

    private var form: some View {
        CardBox {
            if step == "start" {
                Text("Sign in with Muse").font(.title3.weight(.semibold))
                Text("Muse reads your Instagram. We never see your password.")
                    .font(.subheadline).foregroundStyle(.secondary).padding(.top, 4)
                VStack(spacing: 12) {
                    if devMode {
                        field("Server URL", text: $serverUrl, keyboard: .URL)
                    }
                    field("Muse email or phone", text: $identifier, keyboard: .emailAddress)
                    field("Your phone number", text: $phone, keyboard: .phonePad)
                }
                .padding(.top, 20)
                Toggle("Text me about matches", isOn: $textMe).tint(Brand.violet).padding(.top, 14)
                Toggle("Include reels from DMs", isOn: $useDms).tint(Brand.violet).padding(.top, 10)
                // Texts and this approval are both required: texts deliver matches, and the
                // approval lets the server finish Muse's setup. The server enforces this too.
                Button { autoApprove.toggle() } label: {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: autoApprove ? "checkmark.square.fill" : "square")
                            .font(.title3)
                            .foregroundStyle(autoApprove ? Brand.violet : Color.secondary)
                        Text("Let Muse auto-approve Harmonize APIs. Harmonize will never look at your messages or other private data, only posts and reels you have interacted with")
                            .font(.caption).foregroundStyle(.secondary)
                            .multilineTextAlignment(.leading)
                    }
                }
                .buttonStyle(.plain)
                .disabled(busy)
                .padding(.top, 16)
                if !(textMe && autoApprove) {
                    Text("Turn on texts and auto-approve to continue.")
                        .font(.subheadline).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity).padding(.top, 16)
                }
                GradientButton(title: "Continue", busy: busy, enabled: textMe && autoApprove) { Task { await start() } }
                    .padding(.top, textMe && autoApprove ? 20 : 8)
            } else {
                Text(stepTitle).font(.title3.weight(.semibold))
                Text(stepSubtitle)
                    .font(.subheadline).foregroundStyle(.secondary).padding(.top, 4)
                Group {
                    if step == "password" {
                        SecureField("Password", text: $credential)
                            .padding(14)
                    } else if step == "phone" {
                        TextField("555 123 4567", text: $credential)
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)
                            .multilineTextAlignment(.center)
                            .padding(14)
                    } else {
                        TextField("••••••", text: $credential)
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                            .font(.system(size: 26, weight: .semibold, design: .rounded))
                            .kerning(8)
                            .multilineTextAlignment(.center)
                            .padding(12)
                    }
                }
                .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .padding(.top, 20)
                GradientButton(title: step == "phone" ? "Send me the code" : "Verify", busy: busy) { Task { await verify() } }.padding(.top, 20)
                Button("Use a different account") { step = "start"; loginId = nil; credential = ""; error = nil }
                    .font(.subheadline.weight(.medium))
                    .tint(Brand.violet)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 14)
                    .disabled(busy)
            }
            if let status {
                Text(status).font(.subheadline).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity).padding(.top, 14)
            }
            if let error {
                MessageCard(text: error, isError: true, mono: devMode).padding(.top, 16)
            }
        }
    }

    private var stepTitle: String {
        switch step {
        case "password": return "Enter your Muse password"
        case "sms_code": return "Enter the code we texted you"
        case "phone": return "Confirm your phone number"
        // Email sign-ins get the code by email; phone sign-ins by text.
        default: return identifier.contains("@") ? "Check your email" : "Check your texts"
        }
    }

    private var stepSubtitle: String {
        switch step {
        case "password": return "Muse is asking for your password."
        case "sms_code": return "Your Muse account uses two-step sign-in. Enter the code texted to your phone."
        case "phone": return "For two-step sign-in, Muse needs the phone number on your Muse account."
        default: return "Muse sent a code to \(identifier)."
        }
    }

    private var devToggle: some View {
        Toggle("Developer mode", isOn: $devMode)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .tint(Brand.violet)
            .padding(.horizontal, 40)
            .padding(.bottom, 24)
    }

    private func field(_ title: String, text: Binding<String>, keyboard: UIKeyboardType) -> some View {
        TextField(title, text: text)
            .keyboardType(keyboard)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .padding(14)
            .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    // MARK: Actions

    private func start() async {
        error = nil
        guard serverUrl.trimmingCharacters(in: .whitespaces).hasPrefix("http") else {
            return fail(devMode ? "Enter the server URL." : "This build of Harmonize isn't connected to a server. Turn on developer mode to set one.", friendly: true)
        }
        guard !identifier.trimmingCharacters(in: .whitespaces).isEmpty else { return fail("Enter the email or phone number you use for Muse.", friendly: true) }
        guard phone.filter(\.isNumber).count >= 10 else { return fail("Enter your 10-digit phone number.", friendly: true) }
        Api.serverUrl = serverUrl
        busy = true
        status = "Opening Muse…"
        defer { busy = false; status = nil }
        do {
            let result = try await Api.loginStart(
                identifier: identifier.trimmingCharacters(in: .whitespaces),
                phone: phone.trimmingCharacters(in: .whitespaces),
                consent: textMe,
                autoApprove: autoApprove,
                useDms: useDms
            )
            print("Harmonize sign-in: step=\(result.step) token=\(result.device_token == nil ? "no" : "yes")")
            if let token = result.device_token { return store.login(token: token) }
            loginId = result.login_id
            credential = ""
            step = result.step
        } catch {
            fail(error.localizedDescription)
        }
    }

    private func verify() async {
        error = nil
        guard let loginId else { step = "start"; return }
        guard !credential.isEmpty else { return fail(step == "phone" ? "Enter your phone number." : "Enter the code Muse sent you.", friendly: true) }
        busy = true
        status = step == "phone" ? "Sending your number to Muse…" : "Checking your code…"
        defer { busy = false; status = nil }
        do {
            let result = try await Api.loginVerify(loginId: loginId, credential: credential.trimmingCharacters(in: .whitespaces))
            print("Harmonize sign-in: step=\(result.step) token=\(result.device_token == nil ? "no" : "yes")")
            if let token = result.device_token { return store.login(token: token) }
            credential = ""
            step = result.step
        } catch {
            fail(error.localizedDescription)
        }
    }

    private func fail(_ raw: String, friendly: Bool = false) {
        print("Harmonize sign-in error: \(raw)")
        error = devMode || friendly ? raw : Friendly.error(raw)
    }
}
