import ClerkKit
import ClerkKitUI
import SwiftUI

/// One screen: headline, route art, Get started. Clerk's AuthView handles sign in and sign up.
struct SignInView: View {
    @Environment(Clerk.self) private var clerk
    @State private var authPresented = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Wordmark()
                Spacer()
                Button("Sign in") { authPresented = true }
                    .font(NS.sans(15, .semibold))
                    .foregroundStyle(NS.ink)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .overlay(Capsule().stroke(NS.line, lineWidth: 1))
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            Text("Every day of the trip, on one map.")
                .font(NS.display(48))
                .tracking(-1.8)
                .lineSpacing(-6)
                .foregroundStyle(NS.ink)
                .padding(.horizontal, 20)
                .padding(.top, 32)
                .padding(.bottom, 22)
                .fixedSize(horizontal: false, vertical: true)

            RouteArtView()
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .padding(.horizontal, 12)

            Button {
                authPresented = true
            } label: {
                HStack(spacing: 10) {
                    Text("Get started")
                    Image(systemName: "arrow.right").font(.system(size: 16, weight: .bold))
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(PillButtonStyle(tone: .lane))
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .background(Color.white)
        .sheet(isPresented: $authPresented) {
            AuthView(mode: .signInOrUp, isDismissible: true)
        }
        .task {
            for await event in clerk.auth.events {
                if case .signUpNeedsContinuation = event { authPresented = true }
                if case .signInNeedsContinuation = event { authPresented = true }
            }
        }
    }
}

/// Static route illustration (same artwork as the website).
struct RouteArtView: View {
    private let stops: [(CGPoint, String)] = [
        (CGPoint(x: 130, y: 580), "Las Vegas"), (CGPoint(x: 350, y: 350), "Zion"), (CGPoint(x: 490, y: 230), "Bryce"),
        (CGPoint(x: 580, y: 440), "Page"), (CGPoint(x: 490, y: 580), "Grand Canyon"), (CGPoint(x: 580, y: 700), "Sedona"),
    ]

    var body: some View {
        GeometryReader { geo in
            // Fit the route (plus label room) inside the card.
            let region = CGRect(x: 90, y: 190, width: 600, height: 550)
            let scale = min(geo.size.width / region.width, geo.size.height / region.height)
            let offset = CGPoint(x: (geo.size.width - region.width * scale) / 2 - region.minX * scale, y: (geo.size.height - region.height * scale) / 2 - region.minY * scale)
            let map: (CGPoint) -> CGPoint = { CGPoint(x: $0.x * scale + offset.x, y: $0.y * scale + offset.y) }
            ZStack {
                Color(red: 238 / 255, green: 237 / 255, blue: 232 / 255)
                Path { p in
                    p.move(to: map(CGPoint(x: 60, y: 780))); p.addLine(to: map(CGPoint(x: 300, y: 360))); p.addLine(to: map(CGPoint(x: 520, y: 120)))
                    p.move(to: map(CGPoint(x: 0, y: 600))); p.addLine(to: map(CGPoint(x: 820, y: 520)))
                    p.move(to: map(CGPoint(x: 420, y: 0))); p.addLine(to: map(CGPoint(x: 470, y: 220))); p.addLine(to: map(CGPoint(x: 600, y: 440))); p.addLine(to: map(CGPoint(x: 640, y: 780)))
                }
                .stroke(Color.white, lineWidth: 4 * scale)
                let route = Path { p in
                    p.move(to: map(stops[0].0))
                    p.addCurve(to: map(stops[1].0), control1: map(CGPoint(x: 200, y: 480)), control2: map(CGPoint(x: 280, y: 400)))
                    p.addCurve(to: map(stops[2].0), control1: map(CGPoint(x: 400, y: 310)), control2: map(CGPoint(x: 440, y: 250)))
                    p.addCurve(to: map(stops[3].0), control1: map(CGPoint(x: 560, y: 260)), control2: map(CGPoint(x: 600, y: 360)))
                    p.addCurve(to: map(stops[4].0), control1: map(CGPoint(x: 560, y: 500)), control2: map(CGPoint(x: 520, y: 540)))
                    p.addCurve(to: map(stops[5].0), control1: map(CGPoint(x: 520, y: 630)), control2: map(CGPoint(x: 560, y: 660)))
                }
                route.stroke(NS.ink, style: StrokeStyle(lineWidth: 8 * scale, lineCap: .round, lineJoin: .round))
                route.stroke(NS.lane, style: StrokeStyle(lineWidth: 4.5 * scale, lineCap: .round, lineJoin: .round))
                ForEach(Array(stops.enumerated()), id: \.offset) { index, stop in
                    let point = map(stop.0)
                    HStack(spacing: 6) {
                        Text("\(index + 1)")
                            .font(NS.mono(11, .semibold))
                            .foregroundStyle(index == stops.count - 1 ? NS.ink : .white)
                            .frame(width: 24, height: 24)
                            .background(Circle().fill(index == stops.count - 1 ? NS.lane : NS.ink))
                            .overlay(Circle().stroke(index == stops.count - 1 ? NS.ink : .white, lineWidth: 2))
                        Text(stop.1).font(NS.sans(12, .bold)).padding(.horizontal, 8).padding(.vertical, 3).background(Capsule().fill(.white))
                    }
                    .fixedSize()
                    .frame(width: 220, alignment: .leading)
                    .position(x: point.x - 12 + 110, y: point.y)
                }
            }
        }
    }
}
