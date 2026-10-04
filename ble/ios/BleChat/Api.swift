import Foundation

/// The Harmonize server (mhacks26/app/api/app/*). Every call throws `ApiError`
/// with the server's message on failure. Server URL and device token are in
/// UserDefaults.
enum ApiError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        if case .message(let text) = self { return text }
        return nil
    }
}

enum Api {
    private static let defaults = UserDefaults.standard

    static var serverUrl: String {
        get { defaults.string(forKey: "server_url") ?? "" }
        set { defaults.set(newValue.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: "/")), forKey: "server_url") }
    }

    /// Baked in at build time from the repo's .env (see project.yml).
    static var defaultServerUrl: String {
        guard let url = Bundle.main.url(forResource: "server-url", withExtension: "txt"),
              let text = try? String(contentsOf: url, encoding: .utf8) else { return "" }
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static var token: String? {
        get { defaults.string(forKey: "device_token") }
        set { defaults.set(newValue, forKey: "device_token") }
    }

    struct LoginStep: Decodable {
        let step: String
        let login_id: String?
        let device_token: String?
    }

    struct Match: Decodable, Identifiable {
        let other_username: String
        let other_name: String?
        let score: Double
        let verdict: String
        let matched: Bool
        let notified_at: Double?
        let notify_error: String?
        var id: String { other_username }
    }

    struct Me: Decodable {
        let profile_status: String
        let profile_error: String?
        let refresh_error: String?
        let username: String?
        let name: String?
        let loop: Bool
        let match_threshold: Double
        let done: Bool
        let matches: [Match]
        /// The Photon number this person must text once before Photon may text them; nil if texts are off.
        let photon_line: String?
        let first_text_at: Double?
        /// The Match texts switch.
        let consent: Bool
        let texts_confirmed_at: Double?
        let photon_error: String?
        let phone_number: String
        /// The Instagram summary Muse wrote; shown in developer mode.
        let summary: String?
        let summarized_at: Double?
    }

    struct Encounter: Decodable {
        let status: String
        let other_username: String
        let other_name: String?
        let score: Double?
        let verdict: String?
    }

    static func loginStart(identifier: String, phone: String, consent: Bool, autoApprove: Bool, useDms: Bool) async throws -> LoginStep {
        try await request("POST", "/api/app/login/start", body: ["identifier": identifier, "phone_number": phone, "consent": consent, "auto_approve": autoApprove, "use_dms": useDms], auth: false)
    }

    static func loginVerify(loginId: String, credential: String) async throws -> LoginStep {
        try await request("POST", "/api/app/login/verify", body: ["login_id": loginId, "credential": credential], auth: false)
    }

    static func me() async throws -> Me {
        try await request("GET", "/api/app/me", body: nil, auth: true)
    }

    private struct Ok: Decodable { let ok: Bool }

    private struct TextsResult: Decodable { let enabled: Bool; let photon_line: String?; let photon_error: String? }

    /// Turns match texts on or off; returns the Photon line to text first (when on).
    static func setTexts(_ enabled: Bool) async throws -> String? {
        let result: TextsResult = try await request("POST", "/api/app/texts", body: ["enabled": enabled], auth: true)
        if let error = result.photon_error { throw ApiError.message(error) }
        return result.photon_line
    }

    static func reportFirstText(line: String) async throws {
        let _: Ok = try await request("POST", "/api/app/photon/first-text", body: ["line": line], auth: true)
    }

    /// Whether this phone already sent its one-time first text to `line`.
    static func firstTextSent(_ line: String) -> Bool { defaults.bool(forKey: "first_text_\(line)") }
    static func markFirstTextSent(_ line: String) { defaults.set(true, forKey: "first_text_\(line)") }

    static func encounter(_ otherUsername: String) async throws -> Encounter {
        try await request("POST", "/api/app/encounters", body: ["other_username": otherUsername], auth: true)
    }

    private struct ErrorBody: Decodable { let error: String }

    private static func request<T: Decodable>(_ method: String, _ path: String, body: [String: Any]?, auth: Bool) async throws -> T {
        guard !serverUrl.isEmpty, let url = URL(string: serverUrl + path) else { throw ApiError.message("No server URL set") }
        var request = URLRequest(url: url, timeoutInterval: 120) // Muse login steps drive a remote browser
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if auth {
            guard let token else { throw ApiError.message("Not logged in") }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw ApiError.message("Can't reach \(serverUrl): \(error.localizedDescription)")
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status >= 400 {
            let message = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            throw ApiError.message(message ?? "Server returned \(status)")
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw ApiError.message("Unexpected reply from the server: \(String(decoding: data.prefix(200), as: UTF8.self))")
        }
    }
}
