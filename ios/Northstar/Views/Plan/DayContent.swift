import CoreLocation
import SwiftUI

struct DayContent: View {
    @Environment(TripStore.self) private var store
    let day: Day
    @Binding var reordering: Bool
    let onEditStop: (Stop) -> Void
    let onAddStop: () -> Void
    let onEditDay: () -> Void
    @State private var routes = RouteService.shared

    private var stops: [Stop] { TripStore.sortedStops(day.events) }

    private func coordinate(_ stop: Stop) -> CLLocationCoordinate2D? {
        guard stop.hasCoordinates, let lat = stop.latitude, let lng = stop.longitude else { return nil }
        return .init(latitude: lat, longitude: lng)
    }

    private func leg(after index: Int) -> RouteLeg? {
        guard index + 1 < stops.count, let a = coordinate(stops[index]), let b = coordinate(stops[index + 1]) else { return nil }
        return routes.leg(a, b)
    }

    private var totalDrive: (TimeInterval, Double)? {
        let located = stops.compactMap(coordinate)
        guard located.count > 1 else { return nil }
        var duration: TimeInterval = 0, distance: Double = 0
        for (a, b) in zip(located, located.dropFirst()) {
            if let leg = routes.leg(a, b) { duration += leg.duration; distance += leg.distance }
        }
        return duration > 0 ? (duration, distance) : nil
    }

    private var sleep: String? {
        if let s = day.sleepLocation, !s.isEmpty { return s }
        return stops.last { $0.category == "accommodation" }?.title
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("DAY \(day.dayNumber) · \(Fmt.dayLabel(day.date))").font(NS.mono(12)).foregroundStyle(NS.muted)
                        Spacer()
                        if store.canEdit && stops.count > 1 {
                            Button(reordering ? "Done" : "Reorder") { withAnimation { reordering.toggle() } }
                                .font(NS.sans(14, .semibold))
                                .foregroundStyle(NS.ink)
                        }
                    }
                    Button(action: onEditDay) {
                        Text(day.displayTitle).font(NS.display(32)).tracking(-1.1).foregroundStyle(NS.ink).multilineTextAlignment(.leading)
                    }
                    .buttonStyle(.plain)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            if let drive = totalDrive { Chip(icon: "car", text: "\(Fmt.duration(drive.0)) · \(Fmt.miles(drive.1))") }
                            if let sleep { Chip(icon: "bed.double", text: sleep) }
                            if let notes = day.notes, !notes.isEmpty {
                                Button(action: onEditDay) { Chip(icon: "note.text", text: "Day notes") }.buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 8)
                .listRowInsets(EdgeInsets())
                .listRowSeparator(.hidden)
            }

            Section {
                ForEach(Array(stops.enumerated()), id: \.element.id) { index, stop in
                    VStack(spacing: 0) {
                        StopRowView(stop: stop, number: index + 1, highlighted: store.highlightedStopIds.contains(stop.id))
                            .contentShape(Rectangle())
                            .onTapGesture { if !reordering { onEditStop(stop) } }
                        if index < stops.count - 1 && !reordering {
                            LegView(leg: leg(after: index))
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 0, leading: 8, bottom: 0, trailing: 8))
                    .listRowSeparator(.hidden)
                    .swipeActions(edge: .trailing) {
                        if store.canEdit {
                            Button(role: .destructive) { Task { await store.deleteStop(stop.id, dayId: day.id) } } label: { Label("Delete", systemImage: "trash") }
                        }
                    }
                }
                .onMove { from, to in
                    var ids = stops.map(\.id)
                    ids.move(fromOffsets: from, toOffset: to)
                    Task { await store.reorderStops(dayId: day.id, orderedIds: ids) }
                }

                if store.canEdit && !reordering {
                    Button(action: onAddStop) {
                        HStack(spacing: 12) {
                            Spacer().frame(width: 40)
                            Image(systemName: "plus").font(.system(size: 12, weight: .bold))
                                .frame(width: 24, height: 24)
                                .overlay(Circle().strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [3, 3])).foregroundStyle(NS.faint))
                            Text("Add a stop").font(NS.sans(16)).foregroundStyle(NS.muted)
                            Spacer()
                        }
                        .padding(.horizontal, 12)
                        .frame(height: 50)
                    }
                    .foregroundStyle(NS.ink)
                    .listRowInsets(EdgeInsets(top: 0, leading: 8, bottom: 0, trailing: 8))
                    .listRowSeparator(.hidden)
                }
            }
        }
        .listStyle(.plain)
        .environment(\.editMode, .constant(reordering ? .active : .inactive))
        .scrollContentBackground(.hidden)
    }
}

struct StopRowView: View {
    let stop: Stop
    let number: Int
    let highlighted: Bool

    var body: some View {
        HStack(spacing: 12) {
            Text(Fmt.clock(stop.startTime))
                .font(NS.mono(12, highlighted ? .bold : .medium))
                .foregroundStyle(highlighted ? NS.ink : NS.muted)
                .frame(width: 40, alignment: .leading)
            Text("\(number)")
                .font(NS.mono(11, .semibold))
                .foregroundStyle(highlighted ? NS.ink : .white)
                .frame(width: 24, height: 24)
                .background(Circle().fill(highlighted ? NS.lane : NS.ink))
            Text(stop.title).font(NS.sans(16, .semibold)).lineLimit(1).foregroundStyle(NS.ink)
            Spacer(minLength: 4)
            Image(systemName: CategoryInfo.info(stop.category).symbol)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(NS.muted)
            HStack(spacing: 3) {
                if stop.booked { Image(systemName: "checkmark").font(.system(size: 11, weight: .heavy)) }
                if let cost = stop.costValue { Text(Fmt.money(cost)).font(NS.mono(12, .semibold)) }
            }
            .foregroundStyle(stop.booked ? NS.go : NS.ink)
            .frame(width: 56, alignment: .trailing)
        }
        .padding(.horizontal, 12)
        .frame(height: 50)
        .background(RoundedRectangle(cornerRadius: 12).fill(highlighted ? NS.laneSoft : .clear))
    }
}

struct LegView: View {
    let leg: RouteLeg?
    var body: some View {
        let drive = (leg?.duration ?? 0) > 30 * 60
        HStack(spacing: 12) {
            Spacer().frame(width: 40)
            Rectangle().fill(drive ? NS.lane : NS.line).frame(width: drive ? 3 : 2, height: 22).frame(width: 24)
            if let leg {
                Text(Fmt.duration(leg.duration) + (drive ? " drive" : ""))
                    .font(NS.mono(12, drive ? .semibold : .medium))
                    .foregroundStyle(drive ? NS.ink : NS.muted)
            }
            Spacer()
        }
        .padding(.horizontal, 12)
        .frame(height: 22)
    }
}

struct TripContent: View {
    @Environment(TripStore.self) private var store
    let onOpenDay: (Int) -> Void
    let onAsk: (AskDraft) -> Void

    var body: some View {
        let bundle = store.bundle
        let stopCount = store.days.reduce(0) { $0 + $1.events.count }
        List {
            VStack(alignment: .leading, spacing: 8) {
                Text("\(store.days.count) DAYS · \(Fmt.range(bundle?.trip.startDate, bundle?.trip.endDate).uppercased())")
                    .font(NS.mono(12)).foregroundStyle(NS.muted)
                Text(bundle?.trip.name ?? "").font(NS.display(32)).tracking(-1.1)
                HStack(spacing: 8) { Chip(icon: "mappin", text: "\(stopCount) stops") }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 6)
            .listRowInsets(EdgeInsets())
            .listRowSeparator(.hidden)

            ForEach(store.days) { day in
                HStack(spacing: 12) {
                    Text(Fmt.chip(day.date)).font(NS.mono(12)).foregroundStyle(NS.muted).frame(width: 46, alignment: .leading)
                    Text("\(day.dayNumber)")
                        .font(NS.mono(11, .semibold))
                        .foregroundStyle(day.events.isEmpty ? NS.ink : .white)
                        .frame(width: 24, height: 24)
                        .background(Circle().fill(day.events.isEmpty ? Color.clear : NS.ink))
                        .overlay(Circle().strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: day.events.isEmpty ? [3, 3] : [])).foregroundStyle(day.events.isEmpty ? NS.faint : .clear))
                    Text(day.displayTitle).font(NS.sans(16, .semibold)).lineLimit(1)
                    Spacer(minLength: 6)
                    if day.events.isEmpty && store.canEdit {
                        Button {
                            onAsk(AskDraft(text: "Plan Day \(day.dayNumber) (\(Fmt.short(day.date)))\(day.location.isEmpty ? "" : " in \(day.location)") with specific places, times, and drive times.", autoSend: true))
                        } label: {
                            HStack(spacing: 5) {
                                StarShape().fill(NS.ink).frame(width: 12, height: 12)
                                Text("Plan").font(NS.sans(13, .bold))
                            }
                        }
                        .buttonStyle(.borderless)
                    } else {
                        HStack(spacing: 3) {
                            ForEach(0..<min(day.events.count, 8), id: \.self) { _ in Circle().fill(NS.ink).frame(width: 6, height: 6) }
                            if day.events.count > 8 { Text("+\(day.events.count - 8)").font(NS.mono(10, .semibold)).foregroundStyle(NS.muted) }
                        }
                    }
                }
                .padding(.horizontal, 12)
                .frame(height: 44)
                .contentShape(Rectangle())
                .onTapGesture { onOpenDay(day.id) }
                .listRowInsets(EdgeInsets(top: 0, leading: 8, bottom: 0, trailing: 8))
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }
}
