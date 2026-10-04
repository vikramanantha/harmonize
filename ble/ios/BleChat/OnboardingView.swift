import SwiftUI

/// First run: log in to Muse (email/mobile + the code Muse sends) and give a
/// phone number for match texts. The server does the work (lib/muse-session.ts).
struct OnboardingView: View {
    @ObservedObject var store: BleStore
    @State private var serverUrl = Api.serverUrl.isEmpty ? Api.defaultServerUrl : Api.serverUrl
    @State private var identifier = ""
    @State private var phone = ""
    @State private var consent = true
    @State private var autoApprove = false
    @State private var credential = ""
    @State private var loginId: String?
    @State private var step = "start" // start | code | password
    @State private var busy = false
    @State private var status = ""
    @State private var isError = false

    var body: some View {
        NavigationStack {
            Form {
                if step == "start" {
                    Section("Server") {
                        TextField("https://xyz.ngrok.app", text: $serverUrl)
                            .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    }
                    Section("Muse account") {
                        TextField("Email or mobile number", text: $identifier)
                            .keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                    }
                    Section("Your US phone number (for match texts)") {
                        TextField("555 123 4567", text: $phone).keyboardType(.phonePad)
                        Toggle("Text me when someone nearby is a match", isOn: $consent)
                    }
                    Section {
                        Toggle("Approve Muse's access to the Harmony server for me", isOn: $autoApprove)
                    } footer: {
                        Text("Harmony will tap \"Always allow this site\" on Muse's prompt for the server URL above, and no other site.")
                    }
                } else {
                    Section(step == "password" ? "Muse password" : "Verification code Muse sent you") {
                        if step == "password" {
                            SecureField("Password", text: $credential)
                        } else {
                            TextField("Code", text: $credential).keyboardType(.numberPad)
                        }
                    }
                }
                if !status.isEmpty {
                    Text(status).foregroundStyle(isError ? Color.red : Color.secondary)
                }
                Section {
                    Button(busy ? "Working…" : step == "start" ? "Continue with Muse" : "Verify") {
                        Task { await submit() }
                    }
                    .disabled(busy)
                    if step != "start" {
                        Button("Start over") { step = "start"; loginId = nil; credential = ""; status = "" }.disabled(busy)
                    }
                }
            }
            .navigationTitle("Harmony")
        }
    }

    private func submit() async {
        busy = true
        defer { busy = false }
        do {
            let result: Api.LoginStep
            if step == "start" {
                let server = serverUrl.trimmingCharacters(in: .whitespaces)
                guard server.hasPrefix("http") else { return fail("Enter the server URL, e.g. https://xyz.ngrok.app") }
                guard !identifier.trimmingCharacters(in: .whitespaces).isEmpty else { return fail("Enter the email or mobile number of your Muse account") }
                guard phone.filter(\.isNumber).count >= 10 else { return fail("Enter your 10-digit US phone number") }
                Api.serverUrl = server
                show("Opening Muse in a remote browser…")
                result = try await Api.loginStart(identifier: identifier.trimmingCharacters(in: .whitespaces), phone: phone.trimmingCharacters(in: .whitespaces), consent: consent, autoApprove: autoApprove)
            } else {
                guard let loginId, !credential.isEmpty else { return fail("Enter the code") }
                show("Verifying and sending Muse its instructions…")
                result = try await Api.loginVerify(loginId: loginId, credential: credential)
            }
            print("Harmony onboarding: server replied step=\(result.step) login_id=\(result.login_id ?? "-") token=\(result.device_token == nil ? "no" : "yes")")
            if let token = result.device_token {
                store.login(token: token)
                return
            }
            loginId = result.login_id ?? loginId
            step = result.step
            credential = ""
            status = ""
        } catch {
            fail(error.localizedDescription)
        }
    }

    private func show(_ text: String) { status = text; isError = false }
    private func fail(_ text: String) { print("Harmony onboarding error: \(text)"); status = text; isError = true }
}
