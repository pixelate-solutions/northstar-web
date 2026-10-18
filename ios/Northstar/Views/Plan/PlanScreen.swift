import MapKit
import SwiftUI

struct PlanScreen: View {
    @Environment(TripStore.self) private var store
    let onAsk: (AskDraft) -> Void

    @State private var selectedDayId: Int?
    @State private var editingStop: Stop?
    @State private var addingStop = false
    @State private var editingDay: Day?
    @State private var sheet: PlanSheet?
    @State private var camera: MapCameraPosition = .automatic
    @State private var focusedLeg: Int?
    @State private var drawer: DrawerDetent = .half
    /// Finger translation while dragging. Plain @State (not @GestureState): @GestureState snaps back to 0 the
    /// instant the finger lifts, outside any animation, which flashed the drawer to its old height for a frame
    /// before the spring started. Here the reset happens inside the same animation that moves to the new detent.
    @State private var dragOffset: CGFloat = 0
    @GestureState private var isDragging = false

    private var selectedDay: Day? { selectedDayId.flatMap { store.day(id: $0) } }

    var body: some View {
        GeometryReader { geo in
            let heights = DrawerDetent.heights(for: geo.size.height, topInset: geo.safeAreaInsets.top)
            let settled = heights[drawer] ?? 300
            let full = heights[.full]!
            // Rubber-band slightly past the ends instead of stopping dead.
            let raw = settled - dragOffset
            let height = raw > full ? full + (raw - full) * 0.25 : raw < heights[.peek]! ? heights[.peek]! - (heights[.peek]! - raw) * 0.25 : raw

            ZStack(alignment: .bottom) {
                // The map never resizes or re-centers because of the drawer, so it stays perfectly still while dragging.
                PlanMap(
                    day: selectedDay,
                    days: store.days,
                    highlighted: store.highlightedStopIds,
                    focusedLeg: focusedLeg,
                    camera: $camera,
                    onSelectStop: { editingStop = $0 }
                )
                .safeAreaPadding(.bottom, heights[.half]! - 24)
                .ignoresSafeArea(edges: .top)

                VStack(spacing: 0) {
                    mapOverlay
                    Spacer()
                }

                drawerView(height: height, settled: settled, heights: heights, bottomInset: geo.safeAreaInsets.bottom)
            }
            #if DEBUG
            .task { await runDrawerDemoIfRequested(heights: heights) }
            #endif
        }
        .background(Color.white)
        .onChange(of: selectedDayId) { _, _ in
            focusedLeg = nil
            withAnimation(.easeInOut(duration: 0.35)) { camera = .automatic }
        }
        .onChange(of: focusedLeg) { _, leg in
            if leg == nil { withAnimation(.easeInOut(duration: 0.35)) { camera = .automatic } }
        }
        .sheet(item: $editingStop) { stop in
            StopEditorSheet(stop: stop).presentationDetents([.medium, .large]).presentationDragIndicator(.visible).solidSheet()
        }
        .sheet(isPresented: $addingStop) {
            if let day = selectedDay { AddStopSheet(day: day).presentationDetents([.large]).solidSheet() }
        }
        .sheet(item: $editingDay) { day in
            EditDaySheet(day: day).presentationDetents([.medium, .large]).solidSheet()
        }
        .sheet(item: $sheet) { sheet in
            Group {
                switch sheet {
                case .newTrip: NewTripSheet(onDraft: { text in onAsk(AskDraft(text: text, autoSend: true)) })
                case .rename: RenameTripSheet().presentationDetents([.height(240)])
                case .dates: DatesSheet().presentationDetents([.medium])
                case .share: ShareSheet()
                case .account: AccountSheet().presentationDetents([.medium, .large])
                case .deleteTrip: DeleteTripSheet(onDeleted: { selectedDayId = nil }).presentationDetents([.medium])
                }
            }
            .solidSheet()
        }
    }

    private static let settleSpring = (stiffness: 320.0, damping: 34.0)

    /// The drawer is laid out once and slid with an offset, so dragging is a pure transform.
    /// Its white surface extends far below its frame, so it covers the screen down to the bottom edge
    /// (under the tab bar) at every height, including while rubber-banding past full.
    private func drawerView(height: CGFloat, settled: CGFloat, heights: [DrawerDetent: CGFloat], bottomInset: CGFloat) -> some View {
        let full = heights[.full]!
        return VStack(spacing: 0) {
            // Drag handle region: grabber + day strip.
            VStack(spacing: 0) {
                Capsule().fill(Color(white: 0.82)).frame(width: 36, height: 5).padding(.top, 8).padding(.bottom, 10)
                DayStrip(days: store.days, selectedDayId: $selectedDayId)
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("drawer-handle")
            .gesture(
                // Measured in global space: the handle moves with the drawer, so local coordinates would feed back.
                DragGesture(minimumDistance: 2, coordinateSpace: .global)
                    .updating($isDragging) { _, state, _ in state = true }
                    .onChanged { value in dragChanged(value.translation.height) }
                    .onEnded { value in
                        dragEnded(translation: value.translation.height, predicted: value.predictedEndTranslation.height, velocity: value.velocity.height, heights: heights)
                    }
            )
            .onTapGesture {
                if drawer == .peek { settle(to: .half, from: heights[.peek]!, velocity: 0, heights: heights) }
            }

            Group {
                if let day = selectedDay {
                    DayContent(day: day, focusedLeg: $focusedLeg, onEditStop: { editingStop = $0 }, onAddStop: { addingStop = true }, onEditDay: { editingDay = day })
                } else {
                    TripContent(onOpenDay: { selectedDayId = $0 }, onAsk: onAsk)
                }
            }
            // Room for the part of the drawer that's below the screen, so the last rows stay reachable.
            .safeAreaPadding(.bottom, max(0, full - settled))
            .opacity(height < heights[.peek]! + 40 ? 0 : 1)
            .animation(.easeOut(duration: 0.15), value: height < heights[.peek]! + 40)
        }
        .frame(height: full, alignment: .top)
        .frame(maxWidth: .infinity)
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24))
        .background(alignment: .top) {
            // Not clipped: runs well past the bottom of the screen.
            UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24)
                .fill(Color.white)
                .frame(height: full + bottomInset + 600)
                .shadow(color: .black.opacity(0.10), radius: 12, y: -4)
        }
        .offset(y: full - height)
        .onChange(of: isDragging) { _, dragging in
            // The system cancelled the gesture (no onEnded): settle wherever the drawer is closest to.
            if !dragging && dragOffset != 0 { dragEnded(translation: dragOffset, predicted: dragOffset, velocity: 0, heights: heights) }
        }
    }

    private func dragChanged(_ translation: CGFloat) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) { dragOffset = translation }
    }

    private func dragEnded(translation: CGFloat, predicted: CGFloat, velocity: CGFloat, heights: [DrawerDetent: CGFloat]) {
        let settled = heights[drawer] ?? 0
        let current = settled - translation
        let projected = settled - predicted
        let next = DrawerDetent.allCases.min { abs((heights[$0] ?? 0) - projected) < abs((heights[$1] ?? 0) - projected) } ?? .half
        settle(to: next, from: current, velocity: -velocity, heights: heights)
    }

    /// One animation moves from where the drawer is now to the detent, carrying the finger's speed.
    /// `velocity` is in points per second, positive = drawer growing.
    private func settle(to next: DrawerDetent, from current: CGFloat, velocity: CGFloat, heights: [DrawerDetent: CGFloat]) {
        let distance = (heights[next] ?? 0) - current
        let relative = abs(distance) > 1 ? max(-12, min(12, velocity / distance)) : 0
        withAnimation(.interpolatingSpring(mass: 1, stiffness: Self.settleSpring.stiffness, damping: Self.settleSpring.damping, initialVelocity: relative)) {
            drawer = next
            dragOffset = 0
        }
    }

    #if DEBUG
    /// `-NorthstarDrawerDemo YES`: drives the real drag/release functions frame by frame (UI tests can't render
    /// mid-gesture), so a screen recording shows exactly what a finger would.
    private func runDrawerDemoIfRequested(heights: [DrawerDetent: CGFloat]) async {
        guard UserDefaults.standard.bool(forKey: "NorthstarDrawerDemo") else { return }
        while store.bundle == nil { try? await Task.sleep(for: .milliseconds(200)) }
        selectedDayId = store.days.dropFirst().first?.id
        try? await Task.sleep(for: .seconds(3))
        // (distance dragged, ms per frame): up partway, down partway, up past full, down to peek, back up.
        for (distance, step) in [(-220.0, 16), (240.0, 16), (-520.0, 12), (700.0, 12), (-260.0, 16)] {
            let frames = Int(abs(distance) / 6)
            for i in 1...frames {
                dragChanged(distance * Double(i) / Double(frames))
                try? await Task.sleep(for: .milliseconds(step))
            }
            try? await Task.sleep(for: .milliseconds(250)) // finger held still
            dragEnded(translation: distance, predicted: distance, velocity: 0, heights: heights)
            try? await Task.sleep(for: .seconds(1.6))
        }
    }
    #endif

    private var mapOverlay: some View {
        HStack {
            TripMenu(onNewTrip: { sheet = .newTrip }, onRename: { sheet = .rename }, onDates: { sheet = .dates }, onShare: { sheet = .share }, onDelete: { sheet = .deleteTrip }, onSwitched: { selectedDayId = nil })
            Spacer()
            if store.isOffline {
                HStack(spacing: 5) {
                    Image(systemName: "wifi.slash").font(.system(size: 11, weight: .bold))
                    Text(store.outbox.isEmpty ? "Offline" : "Offline · \(store.outbox.count)")
                        .font(NS.sans(13, .bold))
                }
                .foregroundStyle(NS.ink)
                .padding(.horizontal, 10).frame(height: 30)
                .background(Capsule().fill(.white))
                .shadow(color: .black.opacity(0.12), radius: 6, y: 2)
                .accessibilityIdentifier("offline-pill")
            }
            Button { sheet = .account } label: {
                AvatarView(size: 36)
                    .padding(2)
                    .background(Circle().fill(.white))
                    .shadow(color: .black.opacity(0.12), radius: 6, y: 2)
            }
            .accessibilityLabel("Account")
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
}

enum DrawerDetent: CaseIterable {
    case peek, half, full

    static func heights(for total: CGFloat, topInset: CGFloat) -> [DrawerDetent: CGFloat] {
        [.peek: 96, .half: total * 0.52, .full: total - 64]
    }
}

enum PlanSheet: String, Identifiable {
    case newTrip, rename, dates, share, account, deleteTrip
    var id: String { rawValue }
}

// MARK: Map

struct PlanMap: View {
    let day: Day?
    let days: [Day]
    let highlighted: Set<Int>
    let focusedLeg: Int?
    @Binding var camera: MapCameraPosition
    let onSelectStop: (Stop) -> Void
    @State private var routes = RouteService.shared

    private struct MapPoint: Identifiable {
        let id: Int
        let label: String
        let title: String
        let coordinate: CLLocationCoordinate2D
        let highlighted: Bool
        let stop: Stop
    }

    private struct Segment: Identifiable {
        let id: Int
        let line: MKPolyline?
        let a: CLLocationCoordinate2D
        let b: CLLocationCoordinate2D
    }

    private var points: [MapPoint] {
        if let day {
            return TripStore.sortedStops(day.events).enumerated().compactMap { index, stop in
                guard stop.hasCoordinates, let lat = stop.latitude, let lng = stop.longitude else { return nil }
                return MapPoint(id: stop.id, label: "\(index + 1)", title: stop.title, coordinate: .init(latitude: lat, longitude: lng), highlighted: highlighted.contains(stop.id), stop: stop)
            }
        }
        return TripAnchors.compute(days).map {
            MapPoint(id: $0.stop.id, label: "\($0.day.dayNumber)", title: $0.day.displayTitle, coordinate: $0.coordinate, highlighted: false, stop: $0.stop)
        }
    }

    var body: some View {
        let pts = points
        // Resolved here (not inside the Map builder) so route updates re-render the map.
        let segments = zip(pts, pts.dropFirst()).map { a, b in
            Segment(id: a.id, line: routes.polyline(a.coordinate, b.coordinate), a: a.coordinate, b: b.coordinate)
        }
        Map(position: $camera) {
            ForEach(segments) { segment in
                let focused = focusedLeg == nil || focusedLeg == segment.id
                if let line = segment.line {
                    MapPolyline(line).stroke(focused ? NS.ink : NS.ink.opacity(0.18), style: StrokeStyle(lineWidth: focused ? 8 : 5, lineCap: .round, lineJoin: .round))
                    if focused {
                        MapPolyline(line).stroke(NS.lane, style: StrokeStyle(lineWidth: 4.5, lineCap: .round, lineJoin: .round))
                    }
                } else {
                    MapPolyline(coordinates: [segment.a, segment.b]).stroke(NS.ink.opacity(0.3), style: StrokeStyle(lineWidth: 3, dash: [6, 6]))
                }
            }
            ForEach(day?.locations ?? []) { pin in
                if let lat = Double(pin.lat), let lng = Double(pin.lng) {
                    Annotation(pin.name, coordinate: .init(latitude: lat, longitude: lng)) {
                        Circle().fill(NS.faint).frame(width: 10, height: 10).overlay(Circle().stroke(.white, lineWidth: 2))
                    }
                    .annotationTitles(.hidden)
                }
            }
            ForEach(pts) { point in
                Annotation(point.title, coordinate: point.coordinate) {
                    Button { onSelectStop(point.stop) } label: {
                        Text(point.label)
                            .font(NS.mono(point.label.count > 2 ? 9 : 11, .semibold))
                            .foregroundStyle(point.highlighted ? NS.ink : .white)
                            .frame(width: 26, height: 26)
                            .background(Circle().fill(point.highlighted ? NS.lane : NS.ink))
                            .overlay(Circle().stroke(point.highlighted ? NS.ink : .white, lineWidth: 2))
                            .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
                    }
                    .accessibilityLabel(point.title)
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
        .task(id: pts.map { "\($0.id)@\($0.coordinate.latitude),\($0.coordinate.longitude)" }.joined(separator: "|")) {
            routes.ensure(pts.map { ($0.id, $0.coordinate) })
        }
        .onChange(of: focusedLeg) { _, leg in
            guard let leg, let segment = segments.first(where: { $0.id == leg }) else { return }
            let rect = segment.line?.boundingMapRect ?? MKMapRect(points: [MKMapPoint(segment.a), MKMapPoint(segment.b)])
            withAnimation(.easeInOut(duration: 0.4)) { camera = .rect(rect.insetBy(dx: -rect.width * 0.35 - 2000, dy: -rect.height * 0.35 - 2000)) }
        }
    }
}

extension MKMapRect {
    init(points: [MKMapPoint]) {
        let xs = points.map(\.x), ys = points.map(\.y)
        self.init(x: xs.min() ?? 0, y: ys.min() ?? 0, width: (xs.max() ?? 0) - (xs.min() ?? 0), height: (ys.max() ?? 0) - (ys.min() ?? 0))
    }
}

enum TripAnchors {
    struct Anchor { let day: Day; let stop: Stop; let coordinate: CLLocationCoordinate2D }

    /// One point per day (where the day ends), ignoring flights and far-away outliers.
    static func compute(_ days: [Day]) -> [Anchor] {
        let anchors: [Anchor] = days.compactMap { day in
            let located = TripStore.sortedStops(day.events).filter {
                $0.hasCoordinates && $0.category != "flight" && !$0.title.lowercased().contains("airport")
            }
            guard let last = located.last, let lat = last.latitude, let lng = last.longitude else { return nil }
            return Anchor(day: day, stop: last, coordinate: .init(latitude: lat, longitude: lng))
        }
        guard anchors.count >= 3 else { return anchors }
        let lats = anchors.map(\.coordinate.latitude).sorted(), lngs = anchors.map(\.coordinate.longitude).sorted()
        let center = CLLocation(latitude: lats[lats.count / 2], longitude: lngs[lngs.count / 2])
        return anchors.filter { CLLocation(latitude: $0.coordinate.latitude, longitude: $0.coordinate.longitude).distance(from: center) < 1_200_000 }
    }
}

// MARK: Day strip

struct DayStrip: View {
    let days: [Day]
    @Binding var selectedDayId: Int?

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    Button { selectedDayId = nil } label: {
                        Image(systemName: "point.topleft.down.to.point.bottomright.curvepath")
                            .font(.system(size: 14, weight: .semibold))
                            .frame(width: 44, height: 36)
                            .background(Capsule().fill(selectedDayId == nil ? NS.lane : NS.surface))
                    }
                    .accessibilityLabel("Whole trip")
                    .id(-1)
                    ForEach(days) { day in
                        Button { selectedDayId = day.id } label: {
                            Text("\(day.dayNumber)")
                                .font(NS.mono(13, selectedDayId == day.id ? .bold : .semibold))
                                .frame(width: 36, height: 36)
                                .background(Circle().fill(selectedDayId == day.id ? NS.lane : NS.surface))
                        }
                        .accessibilityLabel("Day \(day.dayNumber)")
                        .id(day.id)
                    }
                }
                .foregroundStyle(NS.ink)
                .padding(.horizontal, 16)
            }
            .fadedEdges(.horizontal, length: 14)
            .onChange(of: selectedDayId) { _, id in withAnimation { proxy.scrollTo(id ?? -1, anchor: .center) } }
        }
        .padding(.bottom, 12)
    }
}
