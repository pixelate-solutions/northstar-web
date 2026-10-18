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
    let stop: Stop

    @State private var title = ""
    @State private var hasTime = false
    @State private var time = Date()
    @State private var category = "other"
    @State private var cost = ""
    @State private var booked = false
    @State private var notes = ""
    @State private var details = ""
    @State private var confirmDelete = false
    @State private var changingAddress = false

    private var current: Stop {
        store.day(id: stop.dayId)?.events.first { $0.id == stop.id } ?? stop
    }

    var body: some View {
        let readOnly = !store.canEdit
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    TextField("Stop name", text: $title)
                        .font(NS.sans(24, .heavy))
                        .disabled(readOnly)
                        .onSubmit(saveTitle)
                    Button("Done") { saveAll(); dismiss() }
                        .font(NS.sans(15, .bold))
                        .padding(.horizontal, 16).padding(.vertical, 9)
                        .background(Capsule().fill(NS.lane))
                        .foregroundStyle(NS.ink)
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        if hasTime {
                            DatePicker("", selection: $time, displayedComponents: .hourAndMinute)
                                .labelsHidden()
                                .disabled(readOnly)
                                .onChange(of: time) { _, _ in saveTime() }
                        } else if !readOnly {
                            Button { hasTime = true; saveTime() } label: { Chip(icon: "clock", text: "Add time") }
                        }
                        Menu {
                            ForEach(CategoryInfo.all, id: \.value) { item in
                                Button { category = item.value; save(["category": .string(item.value)]) { $0.category = item.value } } label: {
                                    Label(item.label, systemImage: item.symbol)
                                }
                            }
                        } label: {
                            Chip(icon: CategoryInfo.info(category).symbol, text: CategoryInfo.info(category).label)
                        }
                        .disabled(readOnly)
                        HStack(spacing: 4) {
                            Text("$").font(NS.mono(13)).foregroundStyle(NS.muted)
                            TextField("Cost", text: $cost)
                                .keyboardType(.decimalPad)
                                .font(NS.mono(13))
                                .frame(width: 60)
                                .disabled(readOnly)
                        }
                        .padding(.horizontal, 11).padding(.vertical, 6)
                        .background(Capsule().fill(NS.surface))
                        Button {
                            booked.toggle()
                            let value = booked
                            save(["isBooked": .bool(value)]) { $0.isBooked = value }
                        } label: {
                            HStack(spacing: 5) {
                                if booked { Image(systemName: "checkmark").font(.system(size: 12, weight: .heavy)) }
                                Text(booked ? "Booked" : "Not booked").font(NS.sans(14, .semibold))
                            }
                            .padding(.horizontal, 11).padding(.vertical, 6)
                            .foregroundStyle(booked ? .white : NS.ink)
                            .background(Capsule().fill(booked ? NS.go : NS.surface))
                        }
                        .disabled(readOnly)
                    }
                    .foregroundStyle(NS.ink)
                }

                Button { if !readOnly { changingAddress = true } } label: {
                    FieldBox {
                        HStack(spacing: 8) {
                            Image(systemName: "mappin.and.ellipse").foregroundStyle(current.hasCoordinates ? NS.ink : NS.faint)
                            Text(current.location?.isEmpty == false ? current.location! : "Address").foregroundStyle(current.location?.isEmpty == false ? NS.ink : NS.faint)
                                .lineLimit(2).multilineTextAlignment(.leading)
                            Spacer()
                        }
                    }
                }
                .buttonStyle(.plain)

                if current.hasCoordinates, let lat = current.latitude, let lng = current.longitude {
                    Button {
                        let item = MKMapItem(placemark: MKPlacemark(coordinate: .init(latitude: lat, longitude: lng)))
                        item.name = current.title
                        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
                    } label: {
                        Label("Directions in Maps", systemImage: "arrow.triangle.turn.up.right.diamond")
                            .font(NS.sans(14, .semibold))
                    }
                    .foregroundStyle(NS.ink)
                }

                FieldBox {
                    TextField("Notes", text: $notes, axis: .vertical).lineLimit(2...8).disabled(readOnly)
                }
                if !details.isEmpty || !readOnly {
                    FieldBox {
                        TextField("Details", text: $details, axis: .vertical).lineLimit(1...8).disabled(readOnly)
                    }
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
        .onAppear(perform: load)
        .onDisappear(perform: saveAll)
        .confirmationDialog("Delete \(current.title)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task { await store.deleteStop(stop.id, dayId: stop.dayId) }
                dismiss()
            }
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
        }
    }

    private func load() {
        let s = current
        title = s.title
        category = s.category
        booked = s.booked
        cost = s.costValue.map { $0.truncatingRemainder(dividingBy: 1) == 0 ? String(Int($0)) : String($0) } ?? ""
        notes = s.tip ?? ""
        details = s.description ?? ""
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
        guard Fmt.clock(current.startTime) != value else { return }
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
        if notes != (current.tip ?? "") {
            let value = notes.trimmingCharacters(in: .whitespacesAndNewlines)
            save(["tip": value.isEmpty ? .null : .string(value)]) { $0.tip = value.isEmpty ? nil : value }
        }
        if details != (current.description ?? "") {
            let value = details.trimmingCharacters(in: .whitespacesAndNewlines)
            save(["description": value.isEmpty ? .null : .string(value)]) { $0.description = value.isEmpty ? nil : value }
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
    @State private var hasTime = false
    @State private var time = Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: Date()) ?? Date()

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
                    Toggle(isOn: $hasTime) { Text("Time").font(NS.sans(16, .semibold)) }
                    if hasTime { DatePicker("At", selection: $time, displayedComponents: .hourAndMinute) }
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
            startTime: hasTime ? Fmt.timeString(time) : nil,
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
