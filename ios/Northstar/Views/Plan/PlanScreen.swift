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
    /// Bumped to re-fit the map to the current day/trip (the camera is positioned by PlanMap).
    @State private var fitRequest = 0
    @State private var focusedLeg: Int?
    @State private var drawer: DrawerDetent = .half
    /// Finger translation while dragging. Plain @State (not @GestureState): @GestureState snaps back to 0 the
    /// instant the finger lifts, outside any animation, which flashed the drawer to its old height for a frame
    /// before the spring started. Here the reset happens inside the same animation that moves to the new detent.
    @State private var dragOffset: CGFloat = 0
    @GestureState private var isDragging = false
    @GestureState private var isContentDragging = false
    /// Decided once per gesture: does this drag move the drawer, or belong to what's under the finger?
    @State private var handleDragMoves: Bool?
    @State private var contentDragMoves: Bool?
    /// A long press on a row (drag-to-reorder) must never move the drawer.
    @State private var rowLongPressed = false
    /// True while (and just after) the drawer is being dragged. The day numbers and rows move with the finger,
    /// so lifting it would otherwise count as a tap on whatever ended up under it.
    @State private var suppressTaps = false
    /// Whether the list inside the drawer is scrolled to its top (so pulling down should move the drawer).
    @State private var listAtTop = true
    /// Shared with the map so the compass and scale can live in our overlay instead of under the status bar.
    @Namespace private var mapScope

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
                    scope: mapScope,
                    fitRequest: fitRequest,
                    // Fit routes into the area between the top controls and the drawer at its middle height.
                    visibleInsets: EdgeInsets(top: geo.safeAreaInsets.top + 64, leading: 36, bottom: heights[.half]! + 16, trailing: 36),
                    onSelectStop: { editingStop = $0 }
                )
                // The Apple Maps logo and Legal link sit at the bottom of the map's safe area: keep them in the
                // bottom-left corner just above the low drawer (the drawer covers them when it's higher).
                .safeAreaPadding(.bottom, heights[.peek]! + 4)
                .ignoresSafeArea(edges: .top)

                VStack(spacing: 0) {
                    mapOverlay
                    Spacer()
                }

                drawerView(height: height, settled: settled, heights: heights, bottomInset: geo.safeAreaInsets.bottom)
            }
            .mapScope(mapScope)
            #if DEBUG
            .task { await runDrawerDemoIfRequested(heights: heights) }
            #endif
        }
        .background(Color.white)
        .onChange(of: selectedDayId) { _, _ in
            focusedLeg = nil
            fitRequest += 1
        }
        .onChange(of: focusedLeg) { _, leg in
            if leg == nil { fitRequest += 1 }
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
                DayStrip(days: store.days, selectedDayId: Binding(get: { selectedDayId }, set: { if !suppressTaps { selectedDayId = $0 } }))
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("drawer-handle")
            .simultaneousGesture(
                // Simultaneous so vertical drags work even on the sideways-scrolling day numbers; the first few
                // points decide the axis, so swiping through days never moves the drawer.
                // Measured in global space: the handle moves with the drawer, so local coordinates would feed back.
                DragGesture(minimumDistance: 6, coordinateSpace: .global)
                    .updating($isDragging) { _, state, _ in state = true }
                    .onChanged { value in
                        if handleDragMoves == nil { handleDragMoves = abs(value.translation.height) > abs(value.translation.width) }
                        if handleDragMoves == true { suppressTaps = true; dragChanged(value.translation.height) }
                    }
                    .onEnded { value in
                        if handleDragMoves == true {
                            dragEnded(translation: value.translation.height, predicted: value.predictedEndTranslation.height, velocity: value.velocity.height, heights: heights)
                        }
                        handleDragMoves = nil
                    }
            )
            .onTapGesture {
                if drawer == .peek { settle(to: .half, from: heights[.peek]!, velocity: 0, heights: heights) }
            }

            Group {
                if let day = selectedDay {
                    DayContent(
                        day: day,
                        focusedLeg: $focusedLeg,
                        onEditStop: { stop in if !suppressTaps { editingStop = stop } },
                        onAddStop: { if !suppressTaps { addingStop = true } },
                        onEditDay: { if !suppressTaps { editingDay = day } }
                    )
                } else {
                    TripContent(onOpenDay: { id in if !suppressTaps { selectedDayId = id } }, onAsk: onAsk)
                }
            }
            .environment(\.drawerTapsSuppressed, suppressTaps)
            // Room for the part of the drawer that's below the screen, so the last rows stay reachable.
            .safeAreaPadding(.bottom, max(0, full - settled))
            // Like a native sheet: below full height, vertical drags on the list move the drawer (the list
            // doesn't scroll); at full height, pulling down once the list is at its top moves the drawer.
            .scrollDisabled(drawer != .full || contentDragMoves == true)
            .modifier(ScrollTopTracker(atTop: $listAtTop))
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 0.3).onEnded { _ in rowLongPressed = true }
            )
            .simultaneousGesture(
                DragGesture(minimumDistance: 8, coordinateSpace: .global)
                    .updating($isContentDragging) { _, state, _ in state = true }
                    .onChanged { value in
                        if contentDragMoves == nil {
                            let vertical = abs(value.translation.height) > abs(value.translation.width) * 1.2
                            contentDragMoves = vertical && !rowLongPressed && (drawer != .full || (value.translation.height > 0 && listAtTop))
                        }
                        if contentDragMoves == true { suppressTaps = true; dragChanged(value.translation.height) }
                    }
                    .onEnded { value in
                        if contentDragMoves == true {
                            dragEnded(translation: value.translation.height, predicted: value.predictedEndTranslation.height, velocity: value.velocity.height, heights: heights)
                        }
                        contentDragMoves = nil
                        rowLongPressed = false
                    }
            )
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
        .onChange(of: isDragging || isContentDragging) { _, dragging in
            // The system cancelled the gesture (no onEnded): settle wherever the drawer is closest to.
            guard !dragging else { return }
            handleDragMoves = nil
            contentDragMoves = nil
            rowLongPressed = false
            if dragOffset != 0 { dragEnded(translation: dragOffset, predicted: dragOffset, velocity: 0, heights: heights) }
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
        if suppressTaps {
            // The lift that ends the drag delivers its tap right after; let that pass first.
            Task {
                try? await Task.sleep(for: .milliseconds(350))
                suppressTaps = false
            }
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
        HStack(alignment: .top) {
            // Distance scale sits under the trip menu; it appears while zooming.
            VStack(alignment: .leading, spacing: 10) {
                TripMenu(onNewTrip: { sheet = .newTrip }, onRename: { sheet = .rename }, onDates: { sheet = .dates }, onShare: { sheet = .share }, onDelete: { sheet = .deleteTrip }, onSwitched: { selectedDayId = nil })
                MapScaleView(scope: mapScope)
                    .padding(.leading, 4)
            }
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
            // Compass sits under the profile picture; it appears when the map is rotated (tap to reset north).
            VStack(spacing: 10) {
                Button { sheet = .account } label: {
                    AvatarView(size: 36)
                        .padding(2)
                        .background(Circle().fill(.white))
                        .shadow(color: .black.opacity(0.12), radius: 6, y: 2)
                }
                .accessibilityLabel("Account")
                MapCompass(scope: mapScope)
            }
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
    let scope: Namespace.ID
    let fitRequest: Int
    /// The part of the map that's actually visible (not under the top controls or the drawer), from its edges.
    let visibleInsets: EdgeInsets
    let onSelectStop: (Stop) -> Void
    @State private var routes = RouteService.shared
    @State private var mapSize: CGSize = .zero

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
        Map(position: $camera, scope: scope) {
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
        .mapControls {} // Compass and scale are placed in PlanScreen's overlay.
        .onGeometryChange(for: CGSize.self) { $0.size } action: { size in
            let first = mapSize == .zero
            mapSize = size
            if first { fit(pts.map { MKMapPoint($0.coordinate) }, animated: false) }
        }
        .task(id: pts.map { "\($0.id)@\($0.coordinate.latitude),\($0.coordinate.longitude)" }.joined(separator: "|")) {
            routes.ensure(pts.map { ($0.id, $0.coordinate) })
            fit(pts.map { MKMapPoint($0.coordinate) }, animated: true)
        }
        .onChange(of: fitRequest) { _, _ in fit(pts.map { MKMapPoint($0.coordinate) }, animated: true) }
        .onChange(of: focusedLeg) { _, leg in
            guard let leg, let segment = segments.first(where: { $0.id == leg }) else { return }
            if let line = segment.line {
                var coords = [CLLocationCoordinate2D](repeating: .init(), count: line.pointCount)
                line.getCoordinates(&coords, range: NSRange(location: 0, length: line.pointCount))
                fit(coords.map(MKMapPoint.init), animated: true)
            } else {
                fit([MKMapPoint(segment.a), MKMapPoint(segment.b)], animated: true)
            }
        }
    }

    /// Positions the camera so `points` fill the visible window (between the top controls and the drawer),
    /// rather than the whole map, which the drawer partly covers.
    private func fit(_ points: [MKMapPoint], animated: Bool) {
        guard !points.isEmpty, mapSize.width > 0, mapSize.height > 0 else { return }
        var box = MKMapRect(points: points)
        // At least ~2 km across so a single stop isn't zoomed to the max.
        let minSide = MKMapPointsPerMeterAtLatitude(box.origin.coordinate.latitude) * 2_000
        box = box.insetBy(dx: -max(0, minSide - box.width) / 2, dy: -max(0, minSide - box.height) / 2)
        let windowW = max(80, mapSize.width - visibleInsets.leading - visibleInsets.trailing)
        let windowH = max(80, mapSize.height - visibleInsets.top - visibleInsets.bottom)
        let scale = max(box.width / windowW, box.height / windowH) * 1.15 // map points per screen point, with margin
        let windowCenter = CGPoint(x: visibleInsets.leading + windowW / 2, y: visibleInsets.top + windowH / 2)
        let rect = MKMapRect(
            x: box.midX - windowCenter.x * scale,
            y: box.midY - windowCenter.y * scale,
            width: mapSize.width * scale,
            height: mapSize.height * scale
        )
        if animated {
            withAnimation(.easeInOut(duration: 0.4)) { camera = .rect(rect) }
        } else {
            camera = .rect(rect)
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

/// Reports whether the scroll view below is at its top (iOS 18+; on iOS 17 the handle and day strip still drag).
private struct ScrollTopTracker: ViewModifier {
    @Binding var atTop: Bool

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.onScrollGeometryChange(for: Bool.self) { geometry in
                geometry.contentOffset.y <= -geometry.contentInsets.top + 1
            } action: { _, isAtTop in
                atTop = isAtTop
            }
        } else {
            content
        }
    }
}

extension EnvironmentValues {
    /// True while a drawer drag is ending, so taps under the lifted finger are ignored.
    @Entry var drawerTapsSuppressed = false
}
