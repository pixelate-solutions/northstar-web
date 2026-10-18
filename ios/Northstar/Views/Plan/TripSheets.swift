import ClerkKit
import SwiftUI

/// Trip pill over the map: switch trips and trip-level actions.
struct TripMenu: View {
    @Environment(TripStore.self) private var store
    let onNewTrip: () -> Void
    let onRename: () -> Void
    let onDates: () -> Void
    let onShare: () -> Void
    let onDeleted: () -> Void
    let onSwitched: () -> Void
    @State private var confirmDelete = false

    var body: some View {
        Menu {
            Section {
                ForEach(store.trips) { trip in
                    Button {
                        guard trip.id != store.bundle?.trip.id else { return }
                        onSwitched()
                        Task { await store.switchTrip(trip.id) }
                    } label: {
                        if trip.id == store.bundle?.trip.id {
                            Label(trip.name, systemImage: "checkmark")
                        } else {
                            Text(trip.name)
                        }
                    }
                }
                Button(action: onNewTrip) { Label("New trip", systemImage: "plus") }
            }
            Section {
                if store.isOwner { Button(action: onShare) { Label("Share", systemImage: "square.and.arrow.up") } }
                if store.canEdit {
                    Button(action: onDates) { Label("Dates & days", systemImage: "calendar") }
                    Button(action: onRename) { Label("Rename", systemImage: "pencil") }
                }
                if store.isOwner {
                    Button(role: .destructive) { confirmDelete = true } label: { Label("Delete trip", systemImage: "trash") }
                }
            }
        } label: {
            HStack(spacing: 8) {
                StarShape().fill(NS.lane).frame(width: 13, height: 13)
                    .frame(width: 28, height: 28)
                    .background(Circle().fill(NS.ink))
                Text(store.bundle?.trip.name ?? "").font(NS.sans(15, .bold)).lineLimit(1).foregroundStyle(NS.ink)
                Image(systemName: "chevron.down").font(.system(size: 12, weight: .bold)).foregroundStyle(NS.ink)
            }
            .padding(.leading, 6).padding(.trailing, 12).padding(.vertical, 6)
            .background(Capsule().fill(.white))
            .shadow(color: .black.opacity(0.12), radius: 6, y: 2)
        }
        .accessibilityLabel("Trips")
        .confirmationDialog("Delete \(store.bundle?.trip.name ?? "this trip")?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete trip", role: .destructive) {
                onDeleted()
                Task { await store.deleteTrip() }
            }
        } message: {
            Text("All of its days and stops will be permanently deleted.")
        }
    }
}

struct NewTripSheet: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let onDraft: (String) -> Void
    @State private var destination = ""
    @State private var start = Date()
    @State private var days = 7
    @State private var busy = false
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.system(size: 15, weight: .semibold)).foregroundStyle(NS.ink)
                        .frame(width: 36, height: 36).overlay(Circle().stroke(NS.line))
                }
            }
            Text("Where to?").font(NS.display(48)).tracking(-1.8)
            HStack(spacing: 12) {
                Image(systemName: "mappin.and.ellipse").font(.system(size: 17, weight: .semibold))
                TextField("Utah & Arizona national parks", text: $destination).font(NS.sans(18, .semibold)).focused($focused)
            }
            .padding(.horizontal, 20).frame(height: 62)
            .overlay(Capsule().stroke(NS.ink, lineWidth: 2))
            HStack {
                DatePicker("First day", selection: $start, displayedComponents: .date).font(NS.sans(16, .semibold))
            }
            .padding(.horizontal, 20).frame(height: 56).background(Capsule().fill(NS.surface))
            Stepper(value: $days, in: 1...60) { Text("\(days) days").font(NS.sans(16, .semibold)) }
                .padding(.horizontal, 20).frame(height: 56).background(Capsule().fill(NS.surface))
            Spacer().frame(height: 4)
            Button { Task { await create(draft: true) } } label: {
                HStack(spacing: 10) {
                    StarShape().fill(NS.ink).frame(width: 16, height: 16)
                    Text(busy ? "Creating…" : "Draft it for me")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(PillButtonStyle(tone: .lane))
            .disabled(busy)
            Button { Task { await create(draft: false) } } label: { Text("Start blank").frame(maxWidth: .infinity) }
                .buttonStyle(PillButtonStyle(tone: .outline))
                .disabled(busy)
            Spacer()
        }
        .padding(20)
        .onAppear { focused = true }
    }

    private func create(draft: Bool) async {
        let place = destination.trimmingCharacters(in: .whitespaces)
        guard !place.isEmpty else { focused = true; return }
        busy = true
        defer { busy = false }
        do {
            let startDate = Fmt.isoDate(start)
            try await store.createTrip(name: place, startDate: startDate, days: days)
            dismiss()
            if draft {
                onDraft("Draft a \(days)-day plan for \(place) starting \(startDate). Give every day a title and location, and add specific stops with times, real places, and drive times.")
            }
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }
}

struct RenameTripSheet: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Rename trip").font(NS.sans(22, .heavy))
            TextField("Trip name", text: $name).font(NS.sans(17, .medium)).padding(14).background(RoundedRectangle(cornerRadius: 12).fill(NS.surface))
            HStack {
                Button("Cancel") { dismiss() }.buttonStyle(PillButtonStyle(tone: .outline))
                Button("Save") {
                    let value = name.trimmingCharacters(in: .whitespaces)
                    guard !value.isEmpty else { return }
                    Task { await store.renameTrip(String(value.prefix(80))) }
                    dismiss()
                }
                .buttonStyle(PillButtonStyle(tone: .ink))
            }
        }
        .padding(20)
        .onAppear { name = store.bundle?.trip.name ?? "" }
    }
}

struct DatesSheet: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var start = Date()
    @State private var days = 1

    private var removedStops: Int { store.days.dropFirst(days).reduce(0) { $0 + $1.events.count } }

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("First day", selection: $start, displayedComponents: .date)
                Stepper("\(days) days", value: $days, in: 1...60)
                if days < store.days.count {
                    Text(removedStops > 0 ? "Removes days \(days + 1)–\(store.days.count) and their \(removedStops) stops." : "Removes days \(days + 1)–\(store.days.count).")
                        .font(NS.sans(14, .semibold)).foregroundStyle(NS.stop)
                }
            }
            .navigationTitle("Dates & days")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let startDate = Fmt.isoDate(start), count = days
                        Task { await store.setDates(start: startDate, days: count) }
                        dismiss()
                    }
                    .bold()
                }
            }
            .onAppear {
                start = Fmt.date(store.bundle?.trip.startDate ?? store.days.first?.date).map { Calendar.current.date(byAdding: .hour, value: 12, to: $0) ?? $0 } ?? Date()
                days = max(1, store.days.count)
            }
        }
        .tint(NS.ink)
    }
}

struct ShareSheet: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var members: [Member] = []
    @State private var email = ""
    @State private var canEdit = true
    @State private var busy = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                    Picker("Access", selection: $canEdit) {
                        Text("Can edit").tag(true)
                        Text("Can view").tag(false)
                    }
                    Button(busy ? "Adding…" : "Add") { Task { await add() } }.disabled(busy || !email.contains("@"))
                }
                Section {
                    ForEach(members) { member in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(member.fullName ?? member.email ?? "").font(NS.sans(16, .semibold))
                                if member.fullName != nil, let mail = member.email { Text(mail).font(NS.sans(13)).foregroundStyle(NS.muted) }
                            }
                            Spacer()
                            Text(member.isOwner ? "Owner" : member.role == .viewer ? "Can view" : "Can edit").font(NS.sans(14)).foregroundStyle(NS.muted)
                        }
                        .swipeActions {
                            if !member.isOwner, let membershipId = member.membershipId {
                                Button(role: .destructive) { Task { await remove(membershipId) } } label: { Label("Remove", systemImage: "trash") }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Share")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .task { await load() }
        }
        .tint(NS.ink)
    }

    private var tripId: Int { store.bundle?.trip.id ?? 0 }

    private func load() async {
        do { members = try await APIClient.shared.send("/api/trips/\(tripId)/members") } catch { store.errorMessage = error.localizedDescription }
    }

    private func add() async {
        busy = true
        defer { busy = false }
        struct Response: Decodable { let members: [Member] }
        do {
            let response: Response = try await APIClient.shared.send("/api/trips/\(tripId)/members", method: "POST", body: [
                "email": .string(email.trimmingCharacters(in: .whitespaces)), "role": .string(canEdit ? "collaborator" : "viewer"),
            ])
            members = response.members
            email = ""
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }

    private func remove(_ membershipId: Int) async {
        do {
            try await APIClient.shared.sendVoid("/api/trips/\(tripId)/members/\(membershipId)", method: "DELETE")
            members.removeAll { $0.membershipId == membershipId }
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }
}

struct AccountSheet: View {
    @Environment(Clerk.self) private var clerk
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Wordmark()
            VStack(alignment: .leading, spacing: 4) {
                Text(store.userName).font(NS.sans(20, .bold))
                if let email = clerk.user?.primaryEmailAddress?.emailAddress { Text(email).font(NS.sans(15)).foregroundStyle(NS.muted) }
            }
            Button {
                dismiss()
                Task { try? await clerk.auth.signOut() }
            } label: {
                Text("Sign out").frame(maxWidth: .infinity)
            }
            .buttonStyle(PillButtonStyle(tone: .outline))
            Spacer()
        }
        .padding(24)
    }
}
