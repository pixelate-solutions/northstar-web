import ClerkKit
import PhotosUI
import SwiftUI

/// Trip pill over the map: switch trips and trip-level actions.
struct TripMenu: View {
    @Environment(TripStore.self) private var store
    let onNewTrip: () -> Void
    let onRename: () -> Void
    let onDates: () -> Void
    let onShare: () -> Void
    let onDelete: () -> Void
    let onSwitched: () -> Void

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
                    Button(role: .destructive, action: onDelete) { Label("Delete trip", systemImage: "trash") }
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
    }
}

/// Deleting a trip requires typing its name.
struct DeleteTripSheet: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let onDeleted: () -> Void
    @State private var typed = ""
    @FocusState private var focused: Bool

    private var name: String { store.bundle?.trip.name ?? "" }
    private var matches: Bool { !name.isEmpty && typed.trimmingCharacters(in: .whitespaces) == name.trimmingCharacters(in: .whitespaces) }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Delete \(name)?").font(NS.sans(22, .heavy))
            Text("Type the trip name to confirm.").font(NS.sans(15)).foregroundStyle(NS.muted)
            TextField(name, text: $typed)
                .font(NS.sans(17, .medium))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focused)
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 12).fill(NS.surface))
                .accessibilityIdentifier("delete-trip-name")
            HStack {
                Button("Cancel") { dismiss() }.buttonStyle(PillButtonStyle(tone: .outline))
                Button("Delete trip") {
                    guard matches else { return }
                    onDeleted()
                    dismiss()
                    Task { await store.deleteTrip() }
                }
                .buttonStyle(PillButtonStyle(tone: .danger))
                .disabled(!matches)
                .opacity(matches ? 1 : 0.4)
            }
            Spacer()
        }
        .padding(20)
        .onAppear { focused = true }
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
    @State private var pendingRemove: Member?

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
                                Button { pendingRemove = member } label: { Label("Remove", systemImage: "trash") }
                                    .tint(NS.stop)
                            }
                        }
                    }
                }
            }
            .confirmationDialog("Remove \(pendingRemove?.fullName ?? pendingRemove?.email ?? "this person")?", isPresented: Binding(get: { pendingRemove != nil }, set: { if !$0 { pendingRemove = nil } }), titleVisibility: .visible) {
                Button("Remove", role: .destructive) {
                    if let id = pendingRemove?.membershipId { Task { await remove(id) } }
                    pendingRemove = nil
                }
                Button("Cancel", role: .cancel) { pendingRemove = nil }
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
    @AppStorage(Prefs.use24HourKey) private var use24Hour = false
    @AppStorage(Prefs.checkedToBottomKey) private var checkedToBottom = false
    @AppStorage(Prefs.offlineModeKey) private var offlineMode = false
    @State private var downloader = OfflineDownloader.shared
    @State private var confirmSignOut = false
    @State private var confirmRemove = false
    @State private var editingProfile = false
    @State private var savedSize: Int64 = OfflineStore.shared.sizeOnDisk

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Button { editingProfile = true } label: {
                    HStack(spacing: 14) {
                        AvatarView(size: 56)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(displayName).font(NS.sans(22, .heavy)).foregroundStyle(NS.ink)
                            if let email = clerk.user?.primaryEmailAddress?.emailAddress { Text(email).font(NS.sans(15)).foregroundStyle(NS.muted) }
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.system(size: 14, weight: .bold)).foregroundStyle(NS.faint)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!Connectivity.shared.isOnline)
                .accessibilityIdentifier("edit-profile")

                VStack(spacing: 0) {
                    Toggle(isOn: $use24Hour) { Text("24-hour time").font(NS.sans(16, .semibold)) }
                        .padding(.horizontal, 16).frame(height: 54)
                    Divider().padding(.leading, 16)
                    Toggle(isOn: $checkedToBottom) { Text("Move checked items to bottom").font(NS.sans(16, .semibold)) }
                        .padding(.horizontal, 16).frame(height: 54)
                    Divider().padding(.leading, 16)
                    Toggle(isOn: $offlineMode) { Text("Offline mode").font(NS.sans(16, .semibold)) }
                        .padding(.horizontal, 16).frame(height: 54)
                    if offlineMode || savedSize > 0 {
                        offlineStatus
                            .padding(.horizontal, 16)
                            .padding(.bottom, 14)
                    }
                }
                .tint(NS.go)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(NS.surface))

                Button { confirmSignOut = true } label: {
                    Text("Sign out").frame(maxWidth: .infinity)
                }
                .buttonStyle(PillButtonStyle(tone: .outline))
            }
            .padding(24)
        }
        .onChange(of: offlineMode) { _, on in
            if on { Task { await download() } }
        }
        .onChange(of: downloader.isRunning) { _, _ in savedSize = OfflineStore.shared.sizeOnDisk }
        .sheet(isPresented: $editingProfile) { EditProfileSheet().solidSheet() }
        .confirmationDialog("Sign out?", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) {
                dismiss()
                Task { try? await clerk.auth.signOut() }
            }
            Button("Cancel", role: .cancel) {}
        }
        .confirmationDialog("Delete offline data?", isPresented: $confirmRemove, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                offlineMode = false
                OfflineStore.shared.removeDownloads()
                downloader.completedAt = nil
                savedSize = OfflineStore.shared.sizeOnDisk
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    private var displayName: String {
        let name = [clerk.user?.firstName, clerk.user?.lastName].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        return name.isEmpty ? store.userName : name
    }

    @ViewBuilder private var offlineStatus: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let progress = downloader.progress {
                HStack {
                    Text("Saving for offline").font(NS.sans(14, .bold))
                    Spacer()
                    Text("\(Int(progress * 100))%").font(NS.mono(13, .semibold))
                }
                ProgressView(value: progress).tint(NS.go)
                VStack(alignment: .leading, spacing: 3) {
                    progressRow("Trips", downloader.trips)
                    progressRow("Routes", downloader.routes)
                    progressRow("Map areas", downloader.maps)
                }
                Text("Keep the app open until this finishes.").font(NS.sans(12, .medium)).foregroundStyle(NS.muted)
            } else if let error = downloader.lastError {
                Text(error).font(NS.sans(13, .semibold)).foregroundStyle(NS.stop)
                Button("Try again") { Task { await download() } }.font(NS.sans(14, .bold)).foregroundStyle(NS.ink)
            } else {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 5) {
                            if downloader.completedAt != nil { Image(systemName: "checkmark.circle.fill").foregroundStyle(NS.go) }
                            Text(downloader.completedAt == nil ? "Not fully saved" : "Ready offline").font(NS.sans(14, .bold))
                        }
                        Text(savedDetail).font(NS.sans(12, .medium)).foregroundStyle(NS.muted)
                    }
                    Spacer()
                    if offlineMode && Connectivity.shared.isOnline {
                        Button("Update") { Task { await download() } }.font(NS.sans(13, .bold)).foregroundStyle(NS.ink)
                    }
                    Button("Delete") { confirmRemove = true }.font(NS.sans(13, .bold)).foregroundStyle(NS.stop)
                }
            }
        }
    }

    private var savedDetail: String {
        let size = ByteCountFormatter.string(fromByteCount: savedSize, countStyle: .file)
        guard let date = downloader.completedAt else { return size }
        return "\(size) · \(date.formatted(date: .abbreviated, time: .shortened))"
    }

    private func progressRow(_ label: String, _ value: (done: Int, total: Int)) -> some View {
        HStack {
            Text(label).font(NS.sans(13, .semibold)).foregroundStyle(NS.muted)
            Spacer()
            Text(value.total == 0 ? "—" : "\(value.done) of \(value.total)")
                .font(NS.mono(12, .medium))
                .foregroundStyle(value.total > 0 && value.done == value.total ? NS.go : NS.muted)
        }
    }

    private func download() async {
        await downloader.run(store: store)
        savedSize = OfflineStore.shared.sizeOnDisk
    }
}

/// The signed-in user's photo (saved for offline use), or their initial.
struct AvatarView: View {
    @Environment(Clerk.self) private var clerk
    @Environment(TripStore.self) private var store
    let size: CGFloat
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Circle().fill(NS.ink)
                Text(String((clerk.user?.firstName ?? store.userName).prefix(1)).uppercased())
                    .font(NS.sans(size * 0.42, .bold)).foregroundStyle(.white)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .task(id: clerk.user?.hasImage == true ? clerk.user?.imageUrl : nil) { await loadImage() }
    }

    private func loadImage() async {
        if image == nil, let saved = OfflineStore.shared.avatar { image = UIImage(data: saved) }
        guard let user = clerk.user else { return }
        guard user.hasImage, let url = URL(string: user.imageUrl) else {
            image = nil
            OfflineStore.shared.saveAvatar(nil)
            return
        }
        if let (data, _) = try? await URLSession.shared.data(from: url), let fresh = UIImage(data: data) {
            image = fresh
            OfflineStore.shared.saveAvatar(data)
        }
    }
}

struct EditProfileSheet: View {
    @Environment(Clerk.self) private var clerk
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var photo: PhotosPickerItem?
    @State private var newImage: UIImage?
    @State private var saving = false
    @State private var confirmRemovePhoto = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    PhotosPicker(selection: $photo, matching: .images) {
                        ZStack(alignment: .bottomTrailing) {
                            Group {
                                if let newImage { Image(uiImage: newImage).resizable().scaledToFill().frame(width: 104, height: 104).clipShape(Circle()) }
                                else { AvatarView(size: 104) }
                            }
                            Image(systemName: "camera.fill")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(NS.ink)
                                .frame(width: 34, height: 34)
                                .background(Circle().fill(NS.lane))
                                .overlay(Circle().stroke(.white, lineWidth: 3))
                        }
                    }
                    .accessibilityLabel("Change photo")
                    if clerk.user?.hasImage == true && newImage == nil {
                        Button("Remove photo") { confirmRemovePhoto = true }
                            .font(NS.sans(14, .semibold)).foregroundStyle(NS.stop)
                    }
                    VStack(spacing: 10) {
                        TextField("First name", text: $firstName)
                            .textContentType(.givenName)
                            .font(NS.sans(17, .medium)).padding(14)
                            .background(RoundedRectangle(cornerRadius: 12).fill(NS.surface))
                        TextField("Last name", text: $lastName)
                            .textContentType(.familyName)
                            .font(NS.sans(17, .medium)).padding(14)
                            .background(RoundedRectangle(cornerRadius: 12).fill(NS.surface))
                    }
                }
                .padding(24)
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Saving…" : "Save") { Task { await save() } }.bold().disabled(saving)
                }
            }
            .onAppear {
                firstName = clerk.user?.firstName ?? ""
                lastName = clerk.user?.lastName ?? ""
            }
            .onChange(of: photo) { _, item in
                Task {
                    if let data = try? await item?.loadTransferable(type: Data.self), let image = UIImage(data: data) { newImage = image }
                }
            }
            .confirmationDialog("Remove photo?", isPresented: $confirmRemovePhoto, titleVisibility: .visible) {
                Button("Remove", role: .destructive) {
                    Task {
                        do { try await clerk.user?.deleteProfileImage(); OfflineStore.shared.saveAvatar(nil) } catch { store.errorMessage = error.localizedDescription }
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
        .tint(NS.ink)
    }

    private func save() async {
        guard let user = clerk.user else { return }
        saving = true
        defer { saving = false }
        do {
            let first = firstName.trimmingCharacters(in: .whitespaces), last = lastName.trimmingCharacters(in: .whitespaces)
            if first != (user.firstName ?? "") || last != (user.lastName ?? "") {
                try await user.update(.init(firstName: first, lastName: last))
            }
            if let newImage, let data = newImage.squareThumbnail(400).jpegData(compressionQuality: 0.85) {
                try await clerk.user?.setProfileImage(imageData: data)
                OfflineStore.shared.saveAvatar(data)
            }
            // The server re-reads the name from Clerk on its next request.
            await store.refresh()
            let name = [first, last].filter { !$0.isEmpty }.joined(separator: " ")
            if !name.isEmpty { store.userName = name }
            dismiss()
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }
}

extension UIImage {
    /// Center-cropped square, `side` points wide.
    func squareThumbnail(_ side: CGFloat) -> UIImage {
        let edge = min(size.width, size.height)
        let crop = CGRect(x: (size.width - edge) / 2, y: (size.height - edge) / 2, width: edge, height: edge)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format).image { _ in
            draw(in: CGRect(x: -crop.minX * side / edge, y: -crop.minY * side / edge, width: size.width * side / edge, height: size.height * side / edge))
        }
    }
}
