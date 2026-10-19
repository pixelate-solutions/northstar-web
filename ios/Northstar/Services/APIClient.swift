import Foundation

/// JSON body values, including explicit null (so PATCH can clear fields).
enum JSON: Encodable {
    case string(String), number(Double), int(Int), bool(Bool), null
    indirect case array([JSON]), object([String: JSON])

    /// Reference to a row created offline; swapped for its real id when the change is sent.
    static func tempRef(_ id: Int) -> JSON { .string("{tmp:\(id)}") }

    static func optional(_ value: String?) -> JSON { value.map { .string($0) } ?? .null }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .int(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .null: try c.encodeNil()
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }
}

struct APIError: LocalizedError {
    let message: String
    let status: Int
    var errorDescription: String? { message }
}

/// Talks to the Northstar web API with the signed-in user's Clerk session token.
final class APIClient {
    static let shared = APIClient()

    let baseURL: URL = {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "NorthstarAPIBaseURL") as? String) ?? ""
        return URL(string: raw.isEmpty ? "https://www.northstartravelguide.com" : raw)!
    }()

    /// Supplied by the auth layer; returns a fresh Clerk session JWT.
    var tokenProvider: () async throws -> String? = { nil }
    /// The trip on screen. Sent as `x-trip-id` so reads and writes apply to it, even if another device
    /// (or a browser tab) last opened a different trip on the same account.
    var tripId: Int?

    private let decoder = JSONDecoder()

    func request(_ path: String, method: String = "GET", body: [String: JSON]? = nil, headers: [String: String] = [:]) async throws -> URLRequest {
        var request = URLRequest(url: baseURL.appending(path: path.components(separatedBy: "?")[0]))
        if let query = path.components(separatedBy: "?").dropFirst().first {
            var comps = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!
            comps.percentEncodedQuery = query
            request.url = comps.url
        }
        if !Connectivity.reachable { throw URLError(.notConnectedToInternet) }
        request.httpMethod = method
        request.timeoutInterval = 60
        if let token = try await tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let tripId { request.setValue(String(tripId), forHTTPHeaderField: "x-trip-id") }
        for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        return request
    }

    func send<T: Decodable>(_ path: String, method: String = "GET", body: [String: JSON]? = nil, headers: [String: String] = [:], as type: T.Type = T.self) async throws -> T {
        let req = try await request(path, method: method, body: body, headers: headers)
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError(message: message ?? "Request failed (\(status))", status: status)
        }
        return try decoder.decode(T.self, from: data)
    }

    @discardableResult
    func sendVoid(_ path: String, method: String, body: [String: JSON]? = nil, headers: [String: String] = [:]) async throws -> Data {
        let req = try await request(path, method: method, body: body, headers: headers)
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError(message: message ?? "Request failed (\(status))", status: status)
        }
        return data
    }
}
