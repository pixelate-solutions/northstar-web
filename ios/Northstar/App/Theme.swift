import SwiftUI

enum NS {
    static let ink = Color(red: 17 / 255, green: 17 / 255, blue: 16 / 255)
    static let lane = Color(red: 1, green: 197 / 255, blue: 0)
    static let laneSoft = Color(red: 1, green: 244 / 255, blue: 204 / 255)
    static let go = Color(red: 11 / 255, green: 107 / 255, blue: 79 / 255)
    static let stop = Color(red: 179 / 255, green: 38 / 255, blue: 30 / 255)
    static let surface = Color(red: 243 / 255, green: 243 / 255, blue: 241 / 255)
    static let line = Color(red: 228 / 255, green: 228 / 255, blue: 225 / 255)
    static let muted = Color(red: 98 / 255, green: 98 / 255, blue: 94 / 255)
    static let faint = Color(red: 138 / 255, green: 138 / 255, blue: 132 / 255)

    /// Inter Tight (bundled variable font).
    static func sans(_ size: CGFloat, _ weight: Font.Weight = .medium) -> Font {
        Font.custom("Inter Tight", size: size).weight(weight)
    }

    /// Geist Mono for times, numbers, and money.
    static func mono(_ size: CGFloat, _ weight: Font.Weight = .medium) -> Font {
        Font.custom("Geist Mono", size: size).weight(weight)
    }

    static func display(_ size: CGFloat) -> Font {
        sans(size, .heavy)
    }
}

/// The four-point Northstar star.
struct StarShape: Shape {
    func path(in rect: CGRect) -> Path {
        let c = CGPoint(x: rect.midX, y: rect.midY)
        let r = min(rect.width, rect.height) / 2
        let i = r * 0.2
        var path = Path()
        path.move(to: CGPoint(x: c.x, y: c.y - r))
        path.addLine(to: CGPoint(x: c.x + i, y: c.y - i))
        path.addLine(to: CGPoint(x: c.x + r, y: c.y))
        path.addLine(to: CGPoint(x: c.x + i, y: c.y + i))
        path.addLine(to: CGPoint(x: c.x, y: c.y + r))
        path.addLine(to: CGPoint(x: c.x - i, y: c.y + i))
        path.addLine(to: CGPoint(x: c.x - r, y: c.y))
        path.addLine(to: CGPoint(x: c.x - i, y: c.y - i))
        path.closeSubpath()
        return path
    }
}

struct Wordmark: View {
    var body: some View {
        HStack(spacing: 9) {
            StarShape().fill(NS.ink).frame(width: 24, height: 24)
                .overlay(Circle().fill(NS.lane).frame(width: 4.5, height: 4.5))
            Text("Northstar").font(NS.sans(19, .heavy)).tracking(-0.4)
        }
    }
}

struct Chip: View {
    let icon: String?
    let text: String
    var body: some View {
        HStack(spacing: 6) {
            if let icon { Image(systemName: icon).font(.system(size: 12, weight: .semibold)) }
            Text(text).font(NS.sans(14, .semibold)).lineLimit(1)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 6)
        .background(NS.surface, in: Capsule())
    }
}

struct PillButtonStyle: ButtonStyle {
    enum Tone { case ink, lane, outline, danger }
    var tone: Tone = .ink
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(NS.sans(16, .bold))
            .padding(.horizontal, 22)
            .frame(minHeight: 50)
            .foregroundStyle(tone == .ink || tone == .danger ? Color.white : NS.ink)
            .background(background, in: Capsule())
            .overlay(Capsule().stroke(tone == .outline ? NS.line : .clear, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
    private var background: Color {
        switch tone {
        case .ink: NS.ink
        case .lane: NS.lane
        case .outline: .white
        case .danger: NS.stop
        }
    }
}

// MARK: Preferences

enum Prefs {
    static let use24HourKey = "prefs.use24HourTime"
    static let checkedToBottomKey = "prefs.checkedToBottom"
    static let offlineModeKey = "prefs.offlineMode"
    static var offlineMode: Bool { UserDefaults.standard.bool(forKey: offlineModeKey) }
    static var use24Hour: Bool { UserDefaults.standard.bool(forKey: use24HourKey) }
}

// MARK: Category colors

extension CategoryInfo {
    static func color(_ value: String) -> Color {
        switch value {
        case "sightseeing": Color(red: 0.18, green: 0.44, blue: 0.86)
        case "food": Color(red: 0.89, green: 0.35, blue: 0.05)
        case "hike": Color(red: 0.17, green: 0.54, blue: 0.24)
        case "accommodation": Color(red: 0.40, green: 0.25, blue: 0.85)
        case "drive": Color(red: 0.29, green: 0.31, blue: 0.34)
        case "flight": Color(red: 0.11, green: 0.49, blue: 0.84)
        case "shopping": Color(red: 0.84, green: 0.20, blue: 0.42)
        case "entertainment": Color(red: 0.86, green: 0.52, blue: 0.0)
        default: Color(red: 0.53, green: 0.56, blue: 0.59)
        }
    }
}

// MARK: View helpers

extension View {
    /// Opaque sheet background (no translucent "glass" at partial heights).
    func solidSheet() -> some View {
        presentationBackground(Color.white)
    }
}

/// Fixed-size edge fades that don't depend on the content's size.
struct EdgeFadeMask: ViewModifier {
    let axis: Axis
    var length: CGFloat = 18
    func body(content: Content) -> some View {
        content.mask {
            if axis == .horizontal {
                HStack(spacing: 0) {
                    LinearGradient(colors: [.clear, .black], startPoint: .leading, endPoint: .trailing).frame(width: length)
                    Rectangle().fill(.black)
                    LinearGradient(colors: [.black, .clear], startPoint: .leading, endPoint: .trailing).frame(width: length)
                }
            } else {
                VStack(spacing: 0) {
                    LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom).frame(height: length)
                    Rectangle().fill(.black)
                    LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom).frame(height: length)
                }
            }
        }
    }
}

extension View {
    func fadedEdges(_ axis: Axis, length: CGFloat = 18) -> some View { modifier(EdgeFadeMask(axis: axis, length: length)) }
}

// MARK: Delete confirmation

struct PendingDelete: Identifiable {
    let id = UUID()
    let title: String
    let action: () -> Void
}

extension View {
    /// "Are you sure?" before any delete.
    func confirmDelete(_ pending: Binding<PendingDelete?>) -> some View {
        confirmationDialog(
            pending.wrappedValue.map { "Delete \($0.title)?" } ?? "Delete?",
            isPresented: Binding(get: { pending.wrappedValue != nil }, set: { if !$0 { pending.wrappedValue = nil } }),
            titleVisibility: .visible,
            presenting: pending.wrappedValue
        ) { item in
            Button("Delete", role: .destructive) { item.action(); pending.wrappedValue = nil }
            Button("Cancel", role: .cancel) { pending.wrappedValue = nil }
        }
    }
}

// MARK: Checked items

/// Keeps a just-checked row in place briefly, so it strikes through before (optionally) sliding to the bottom.
@Observable
@MainActor
final class CheckSettler {
    private var held: [Int: Bool] = [:]

    /// The checked state used for ordering.
    func sortState(_ id: Int, _ actual: Bool) -> Bool { held[id] ?? actual }

    func toggled(_ id: Int, from previous: Bool) {
        held[id] = previous
        Task {
            try? await Task.sleep(for: .milliseconds(900))
            withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { _ = self.held.removeValue(forKey: id) }
        }
    }
}
