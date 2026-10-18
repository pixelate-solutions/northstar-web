import Foundation

enum Fmt {
    private static let iso: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func date(_ s: String?) -> Date? { s.flatMap { iso.date(from: String($0.prefix(10))) } }
    static func isoDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }

    private static func string(_ s: String?, _ format: String) -> String {
        guard let d = date(s) else { return "" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = format
        return f.string(from: d)
    }

    /// "Jun 14"
    static func short(_ s: String?) -> String { string(s, "MMM d") }
    /// "SUN JUN 14"
    static func dayLabel(_ s: String) -> String { string(s, "EEE MMM d").uppercased() }
    /// "SUN 14"
    static func chip(_ s: String) -> String { string(s, "EEE d").uppercased() }

    static func range(_ start: String?, _ end: String?) -> String {
        guard let start else { return "" }
        guard let end, end != start else { return short(start) }
        if string(start, "MMM") == string(end, "MMM") { return "\(short(start)) – \(string(end, "d"))" }
        return "\(short(start)) – \(short(end))"
    }

    /// "07:00:00" -> "07:00"
    static func clock(_ t: String?) -> String { t.map { String($0.prefix(5)) } ?? "" }

    static func money(_ value: Double, cents: Bool = false) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.locale = Locale(identifier: "en_US")
        f.maximumFractionDigits = cents ? 2 : 0
        f.minimumFractionDigits = cents ? 2 : 0
        return f.string(from: NSNumber(value: value)) ?? "$\(value)"
    }

    static func duration(_ seconds: TimeInterval) -> String {
        let minutes = max(1, Int((seconds / 60).rounded()))
        if minutes < 60 { return "\(minutes) min" }
        let h = minutes / 60, m = minutes % 60
        return m == 0 ? "\(h)h" : "\(h)h \(m)m"
    }

    static func miles(_ meters: Double) -> String {
        let mi = meters / 1609.344
        return mi < 10 ? String(format: "%.1f mi", mi) : "\(Int(mi.rounded())) mi"
    }

    static func timeString(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }

    static func timeDate(_ t: String?) -> Date? {
        guard let t, t.count >= 5 else { return nil }
        let parts = t.prefix(5).split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return nil }
        return Calendar.current.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: Date())
    }
}
