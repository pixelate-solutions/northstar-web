import MapKit
import SwiftUI

struct FieldBox<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        content
            .font(NS.sans(15, .medium))
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(NS.surface))
    }
}

struct StopEditorSheet: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    let stop: Stop

    @State private var title = ""
    @State private var hasTime = false
    @State private var time = Date()
    @AppStorage(Prefs.use24HourKey) private var use24Hour = false
    @State private var category = "other"
    @State private var cost = ""
    @State private var booked = false
    @State private var notes = ""
    @State private var confirmDelete = false
    @State private var changingAddress = false

    private static let tileHeight: CGFloat = 48

    private var current: Stop {
        store.day(id: stop.dayId)?.events.first { $0.id == stop.id } ?? stop
    }

    var body: some View {
        let readOnly = !store.canEdit
        let categoryColor = CategoryInfo.color(category)
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Changes save as you go (and when the sheet closes), so there's no Done button.
                TextField("Stop name", text: $title, axis: .vertical)
                    .font(NS.sans(24, .heavy))
                    .lineLimit(1...3)
                    .disabled(readOnly)
                    .submitLabel(.done)
                    .onSubmit(saveTitle)
                    .padding(.top, 6)

                // Time, category, cost and booked as a 2×2 grid: everything visible, nothing to scroll.
                Grid(horizontalSpacing: 8, verticalSpacing: 8) {
                    GridRow {
                        if hasTime {
                            tile {
                                Image(systemName: "clock").font(.system(size: 14, weight: .semibold)).foregroundStyle(NS.muted)
                                Text(Fmt.clock(Fmt.timeString(time), use24Hour: use24Hour))
                                Spacer(minLength: 0)
                            }
                            // The system picker draws its own capsule; keep it invisible on top so the tile
                            // looks like the others and tapping it still opens the time picker.
                            .overlay {
                                DatePicker("", selection: $time, displayedComponents: .hourAndMinute)
                                    .labelsHidden()
                                    .disabled(readOnly)
                                    .onChange(of: time) { _, _ in saveTime() }
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                    .scaleEffect(x: 3, y: 1.4)
                                    .colorMultiply(.clear) // fully invisible, still tappable
                                    .accessibilityLabel("Time")
                            }
                            .clipped()
                        } else {
                            Button { hasTime = true; saveTime() } label: {
                                tile {
                                    Image(systemName: "clock").font(.system(size: 14, weight: .semibold))
                                    Text("Add time")
                                    Spacer(minLength: 0)
                                }
                            }
                            .disabled(readOnly)
                        }
                        Menu {
                            ForEach(CategoryInfo.all, id: \.value) { item in
                                Button { category = item.value; save(["category": .string(item.value)]) { $0.category = item.value } } label: {
                                    Label(item.label, systemImage: item.symbol)
                                }
                            }
                        } label: {
                            tile(fill: categoryColor.opacity(0.13)) {
                                Image(systemName: CategoryInfo.info(category).symbol).font(.system(size: 14, weight: .bold))
                                Text(CategoryInfo.info(category).label)
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.up.chevron.down").font(.system(size: 11, weight: .bold)).opacity(0.7)
                            }
                            .foregroundStyle(categoryColor)
                        }
                        .disabled(readOnly)
                        .accessibilityLabel("Category: \(CategoryInfo.info(category).label)")
                    }
                    GridRow {
                        tile {
                            Text("$").font(NS.mono(15, .semibold)).foregroundStyle(NS.muted)
                            TextField("Cost", text: $cost)
                                .keyboardType(.decimalPad)
                                .font(NS.mono(15, .semibold))
                                .disabled(readOnly)
                        }
                        Button {
                            booked.toggle()
                            let value = booked
                            save(["isBooked": .bool(value)]) { $0.isBooked = value }
                        } label: {
                            if booked {
                                tile(fill: NS.go) {
                                    Image(systemName: "checkmark.circle.fill").font(.system(size: 15, weight: .bold))
                                    Text("Booked")
                                    Spacer(minLength: 0)
                                }
                                .foregroundStyle(.white)
                            } else {
                                tile(fill: .white, stroke: NS.ink) {
                                    Image(systemName: "circle").font(.system(size: 15, weight: .bold))
                                    Text("Mark booked")
                                    Spacer(minLength: 0)
                                }
                                .foregroundStyle(NS.ink)
                            }
                        }
                        .disabled(readOnly)
                        .accessibilityLabel(booked ? "Booked" : "Mark booked")
                    }
                }
                .foregroundStyle(NS.ink)

                HStack(spacing: 8) {
                    Button { if !readOnly { changingAddress = true } } label: {
                        FieldBox {
                            HStack(spacing: 8) {
                                Image(systemName: "mappin.and.ellipse").foregroundStyle(current.hasCoordinates ? NS.ink : NS.faint)
                                Text(current.location?.isEmpty == false ? current.location! : "Address").foregroundStyle(current.location?.isEmpty == false ? NS.ink : NS.faint)
                                    .lineLimit(2).multilineTextAlignment(.leading)
                                Spacer(minLength: 0)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    if let url = directionsURL {
                        Button { openURL(url) } label: {
                            Image(systemName: "arrow.triangle.turn.up.right.diamond.fill")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(NS.ink)
                                .frame(width: 46, height: 46)
                                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(NS.lane))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Open in Maps")
                    }
                }

                FieldBox {
                    TextField("Notes", text: $notes, axis: .vertical).lineLimit(3...14).disabled(readOnly)
                }

                if !readOnly {
                    HStack {
                        Button(role: .destructive) { confirmDelete = true } label: {
                            Label("Delete", systemImage: "trash").font(NS.sans(15, .semibold))
                        }
                        .foregroundStyle(NS.stop)
                        Spacer()
                        Menu {
                            ForEach(store.days.filter { $0.id != stop.dayId }) { day in
                                Button("Day \(day.dayNumber) · \(day.displayTitle)") {
                                    Task { await store.moveStop(stop.id, from: stop.dayId, to: day.id) }
                                    dismiss()
                                }
                            }
                        } label: {
                            Label("Move to another day", systemImage: "arrow.left.arrow.right").font(NS.sans(15, .semibold))
                        }
                        .foregroundStyle(NS.muted)
                    }
                    .padding(.top, 4)
                }
            }
            .padding(20)
        }
        .scrollDismissesKeyboard(.interactively)
        .onAppear(perform: load)
        .onDisappear(perform: saveAll)
        .confirmationDialog("Delete \(current.title)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task { await store.deleteStop(stop.id, dayId: stop.dayId) }
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        }
        .sheet(isPresented: $changingAddress) {
            PlacePickerSheet(near: current.hasCoordinates ? CLLocationCoordinate2D(latitude: current.latitude!, longitude: current.longitude!) : nil) { place in
                let address = place.address.isEmpty ? place.name : "\(place.name), \(place.address)"
                save(["location": .string(address), "lat": .number(place.coordinate.latitude), "lng": .number(place.coordinate.longitude)]) {
                    $0.location = address
                    $0.lat = String(place.coordinate.latitude)
                    $0.lng = String(place.coordinate.longitude)
                }
            }
            .solidSheet()
        }
    }

    /// Opens the stop's place card in Apple Maps (with its Directions button). Asking Maps for driving directions
    /// directly shows "Change Stop" whenever no driving route exists from where you are (e.g. Michigan → Paris).
    private var directionsURL: URL? {
        guard current.hasCoordinates, let lat = current.latitude, let lng = current.longitude else { return nil }
        if #available(iOS 18.4, *) {
            var components = URLComponents(string: "https://maps.apple.com/place")!
            components.queryItems = [URLQueryItem(name: "coordinate", value: "\(lat),\(lng)"), URLQueryItem(name: "name", value: current.title)]
            return components.url
        }
        var components = URLComponents(string: "https://maps.apple.com/")!
        components.queryItems = [URLQueryItem(name: "ll", value: "\(lat),\(lng)"), URLQueryItem(name: "q", value: current.title)]
        return components.url
    }

    private func tile<Content: View>(fill: Color = NS.surface, stroke: Color? = nil, @ViewBuilder _ content: () -> Content) -> some View {
        HStack(spacing: 8) { content() }
            .font(NS.sans(15, .semibold))
            .lineLimit(1)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, minHeight: Self.tileHeight, maxHeight: Self.tileHeight, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(fill))
            .overlay { if let stroke { RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(stroke, lineWidth: 1.5) } }
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func load() {
        let s = current
        title = s.title
        category = s.category
        booked = s.booked
        cost = s.costValue.map { $0.truncatingRemainder(dividingBy: 1) == 0 ? String(Int($0)) : String($0) } ?? ""
        // One notes field: older stops may also carry text in `description`.
        var parts: [String] = []
        for text in [s.tip, s.description].compactMap({ $0?.trimmingCharacters(in: .whitespacesAndNewlines) }) where !text.isEmpty && !parts.contains(text) {
            parts.append(text)
        }
        notes = parts.joined(separator: "\n\n")
        if let t = Fmt.timeDate(s.startTime) { time = t; hasTime = true }
    }

    private func save(_ patch: [String: JSON], apply: @escaping (inout Stop) -> Void) {
        guard store.canEdit else { return }
        Task { await store.updateStop(stop.id, dayId: stop.dayId, patch: patch, apply: apply) }
    }

    private func saveTitle() {
        let next = title.trimmingCharacters(in: .whitespaces)
        guard !next.isEmpty, next != current.title else { return }
        save(["title": .string(next)]) { $0.title = next }
    }

    private func saveTime() {
        let value = Fmt.timeString(time)
        guard current.startTime?.prefix(5) != Substring(value) else { return }
        save(["startTime": .string(value)]) { $0.startTime = "\(value):00" }
    }

    private func saveAll() {
        guard store.canEdit else { return }
        saveTitle()
        let currentCost = current.costValue
        let nextCost = Double(cost)
        if nextCost != currentCost {
            save(["cost": nextCost.map { .number($0) } ?? .null]) { $0.cost = nextCost.map { String($0) } }
        }
        let value = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasDescription = !(current.description ?? "").isEmpty
        if value != (current.tip ?? "") || hasDescription {
            save(["tip": value.isEmpty ? .null : .string(value), "description": .null]) {
                $0.tip = value.isEmpty ? nil : value
                $0.description = nil
            }
        }
    }
}

/// Apple Maps search used for adding stops and changing a stop's address.
struct PlacePickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    let near: CLLocationCoordinate2D?
    let onPick: (ResolvedPlace) -> Void
    @State private var search = PlaceSearch()
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            List(search.suggestions) { suggestion in
                Button {
                    Task {
                        if let place = await search.resolve(suggestion) { onPick(place) }
                        dismiss()
                    }
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(suggestion.title).font(NS.sans(16, .semibold)).foregroundStyle(NS.ink)
                        if !suggestion.subtitle.isEmpty { Text(suggestion.subtitle).font(NS.sans(13)).foregroundStyle(NS.muted) }
                    }
                }
            }
            .listStyle(.plain)
            .searchable(text: Binding(get: { search.query }, set: { search.query = $0 }), placement: .navigationBarDrawer(displayMode: .always), prompt: "Search places")
            .onSubmit(of: .search) {
                Task {
                    if let place = await search.search(search.query) { onPick(place); dismiss() }
                }
            }
            .navigationTitle("Address")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .onAppear { search.bias(to: near) }
        }
    }
}

struct AddStopSheet: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let day: Day
    @State private var search = PlaceSearch()
    /// New stops default to the current time until it's changed.
    @State private var time = Date()

    private var center: CLLocationCoordinate2D? {
        let located = day.events.compactMap { s -> CLLocationCoordinate2D? in
            guard s.hasCoordinates, let la = s.latitude, let lo = s.longitude else { return nil }
            return .init(latitude: la, longitude: lo)
        }
        guard !located.isEmpty else { return nil }
        return .init(latitude: located.map(\.latitude).reduce(0, +) / Double(located.count), longitude: located.map(\.longitude).reduce(0, +) / Double(located.count))
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    DatePicker(selection: $time, displayedComponents: .hourAndMinute) { Text("Time").font(NS.sans(16, .semibold)) }
                }
                if !search.query.trimmingCharacters(in: .whitespaces).isEmpty {
                    Section {
                        Button { Task { await add(name: search.query.trimmingCharacters(in: .whitespaces), place: nil) } } label: {
                            Label("Add \u{201C}\(search.query.trimmingCharacters(in: .whitespaces))\u{201D}", systemImage: "plus.circle")
                                .font(NS.sans(16, .semibold))
                        }
                        ForEach(search.suggestions) { suggestion in
                            Button {
                                Task {
                                    let place = await search.resolve(suggestion)
                                    await add(name: place?.name ?? suggestion.title, place: place)
                                }
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(suggestion.title).font(NS.sans(16, .semibold)).foregroundStyle(NS.ink)
                                    if !suggestion.subtitle.isEmpty { Text(suggestion.subtitle).font(NS.sans(13)).foregroundStyle(NS.muted) }
                                }
                            }
                        }
                    }
                }
            }
            .searchable(text: Binding(get: { search.query }, set: { search.query = $0 }), placement: .navigationBarDrawer(displayMode: .always), prompt: "Search a place or type a stop")
            .onSubmit(of: .search) {
                let text = search.query.trimmingCharacters(in: .whitespaces)
                Task { await add(name: text, place: await search.search(text)) }
            }
            .navigationTitle("Add a stop")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .onAppear { search.bias(to: center) }
        }
        .tint(NS.ink)
    }

    private func add(name: String, place: ResolvedPlace?) async {
        guard !name.isEmpty else { return }
        dismiss()
        let address = place.map { $0.address.isEmpty ? $0.name : "\($0.name), \($0.address)" }
        await store.addStop(
            dayId: day.id,
            title: name,
            startTime: Fmt.timeString(time),
            category: CategoryInfo.guess("\(name) \(place?.address ?? "")"),
            location: address,
            lat: place?.coordinate.latitude,
            lng: place?.coordinate.longitude
        )
    }
}

struct EditDaySheet: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let day: Day
    @State private var title = ""
    @State private var location = ""
    @State private var sleep = ""
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Title") { TextField("Title", text: $title) }
                Section("Where") { TextField("Where", text: $location) }
                Section("Sleeping at") { TextField("Hotel or address", text: $sleep) }
                Section("Day notes") { TextField("Notes", text: $notes, axis: .vertical).lineLimit(3...12) }
            }
            .disabled(!store.canEdit)
            .navigationTitle("Day \(day.dayNumber)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                if store.canEdit {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            Task { await store.updateDay(day, title: title, location: location, sleep: sleep.isEmpty ? nil : sleep, notes: notes.isEmpty ? nil : notes) }
                            dismiss()
                        }
                        .bold()
                    }
                }
            }
            .onAppear {
                title = day.title
                location = day.location
                sleep = day.sleepLocation ?? ""
                notes = day.notes ?? ""
            }
        }
        .tint(NS.ink)
    }
}
