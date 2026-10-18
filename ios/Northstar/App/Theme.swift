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
