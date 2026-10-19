import Foundation
import Observation
import UIKit

@Observable
@MainActor
final class TripStore {
    var bundle: TripBundle? {
        didSet { bundleChanged() }
    }
    var trips: [TripSummary] = []
    /// Showing data saved on this phone because there's no connection.
    var isOffline = false
    /// Changes made offline that haven't reached the server yet.
    private(set) var outbox: [PendingRequest] = OfflineStore.shared.outbox
    private var syncing = false
    private var saveTask: Task<Void, Never>?
    /// Writes currently being sent; live refreshes wait so they can't overwrite an edit in flight.
    private var inFlightWrites = 0
    /// Last seen fingerprint of the trip on the server (see /api/trip/version).
    private var serverVersion: (tripId: Int, version: String)?
    private var liveTask: Task<Void, Never>?
    var userName = ""
    var isLoading = false
    var errorMessage: String?
    var highlightedStopIds: Set<Int> = []
    var askConversationId: Int?
    /// A request handed to the Ask tab (e.g. "Plan this day"); consumed by AskScreen.
    var pendingAskDraft: AskDraft?

    private let api = APIClient.shared
    private var nextTempId = UserDefaults.standard.integer(forKey: "northstar.nextTempId") == 0 ? -1 : UserDefaults.standard.integer(forKey: "northstar.nextTempId")
    private var pendingCreates: [Int: Task<Int?, Never>] = [:]

    init() {
        NotificationCenter.default.addObserver(forName: .northstarBackOnline, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in await self?.cameBackOnline() }
        }
        NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in await self?.checkForCollaboratorChanges() }
        }
        startLiveUpdates()
    }

    var canEdit: Bool { bundle.map { $0.role != .viewer } ?? false }
    var isOwner: Bool { bundle?.role == .owner }
    var days: [Day] { bundle?.days.sorted { $0.date < $1.date } ?? [] }

    func day(id: Int) -> Day? { bundle?.days.first { $0.id == id } }

    nonisolated static func sortedStops(_ stops: [Stop]) -> [Stop] {
        stops.sorted {
            let a = $0.sortOrder ?? 0, b = $1.sortOrder ?? 0
            if a != b { return a < b }
            if ($0.startTime ?? "") != ($1.startTime ?? "") { return ($0.startTime ?? "") < ($1.startTime ?? "") }
            return $0.id < $1.id
        }
    }

    // MARK: Loading

    func load() async {
        isLoading = bundle == nil
        defer { isLoading = false }
        do {
            async let me: Me = api.send("/api/me")
            async let trip: TripBundle = api.send("/api/trip")
            let (meValue, tripValue) = try await (me, trip)
            trips = meValue.trips
            userName = meValue.user.name
            bundle = tripValue
            isOffline = false
            errorMessage = nil
            if Prefs.offlineMode { OfflineStore.shared.save(meValue) }
            await sync()
        } catch where isOfflineError(error) {
            loadSaved(tripId: UserDefaults.standard.object(forKey: "northstar.lastTripId") as? Int)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Falls back to the copy saved on this phone.
    private func loadSaved(tripId: Int?) {
        guard let me = OfflineStore.shared.me,
              let saved = OfflineStore.shared.bundle(tripId: tripId ?? me.activeTripId) ?? OfflineStore.shared.bundle(tripId: me.activeTripId)
        else {
            if bundle == nil { errorMessage = "You're offline, and this trip isn't saved on this phone. Turn on Offline mode while connected to keep a copy." }
            isOffline = bundle != nil
            return
        }
        trips = me.trips
        if userName.isEmpty { userName = me.user.name }
        bundle = saved
        isOffline = true
        errorMessage = nil
    }

    func refresh() async {
        do {
            bundle = try await api.send("/api/trip")
            let me: Me = try await api.send("/api/me")
            trips = me.trips
            userName = me.user.name
            isOffline = false
            if Prefs.offlineMode { OfflineStore.shared.save(me) }
        } catch where isOfflineError(error) {
            isOffline = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func switchTrip(_ id: Int) async {
        do {
            bundle = try await api.send("/api/trip?tripId=\(id)")
            askConversationId = nil
            let me: Me = try await api.send("/api/me")
            trips = me.trips
        } catch where isOfflineError(error) {
            if let saved = OfflineStore.shared.bundle(tripId: id) {
                bundle = saved
                askConversationId = nil
                isOffline = true
            } else {
                errorMessage = "That trip isn't saved on this phone yet."
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// After Offline mode downloads everything, keep showing the fresh copy.
    func adoptDownloaded(_ downloaded: TripBundle, me: Me) {
        trips = me.trips
        if downloaded.trip.id == bundle?.trip.id && outbox.isEmpty { bundle = downloaded }
    }

    // MARK: Live updates

    /// Every few seconds while the app is open, picks up changes collaborators made (from any device).
    private func startLiveUpdates() {
        liveTask?.cancel()
        liveTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4))
                guard let self else { return }
                if UIApplication.shared.applicationState == .active { await self.checkForCollaboratorChanges() }
            }
        }
    }

    /// Reloads the trip if anything on the server changed since we last looked.
    func checkForCollaboratorChanges() async {
        guard let tripId = bundle?.trip.id, Connectivity.reachable, outbox.isEmpty, inFlightWrites == 0, !syncing else { return }
        struct Version: Decodable { let tripId: Int; let version: String }
        guard let latest: Version = try? await api.send("/api/trip/version", headers: ["x-trip-id": String(tripId)]),
              latest.tripId == tripId else { return }
        let previous = serverVersion
        serverVersion = (tripId, latest.version)
        guard let previous, previous.tripId == tripId, previous.version != latest.version else { return }
        guard let fresh: TripBundle = try? await api.send("/api/trip", headers: ["x-trip-id": String(tripId)]),
              // Skip if the user switched trips or started an edit while we were fetching.
              fresh.trip.id == bundle?.trip.id, inFlightWrites == 0, outbox.isEmpty else { return }
        bundle = fresh
        isOffline = false
    }

    // MARK: Offline

    private func bundleChanged() {
        guard let bundle else { return }
        APIClient.shared.tripId = bundle.trip.id
        UserDefaults.standard.set(bundle.trip.id, forKey: "northstar.lastTripId")
        // Keep a copy while Offline mode is on, and always while offline edits are waiting to sync.
        guard Prefs.offlineMode || !outbox.isEmpty || isOffline else { return }
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            OfflineStore.shared.save(bundle)
        }
    }

    private func cameBackOnline() async {
        await sync()
        if isOffline { await load() }
    }

    /// Sends a write now, or queues it when there's no connection. Returns the response, or nil if queued.
    @discardableResult
    private func perform(_ method: String, _ path: String, body: [String: JSON]? = nil, createsTempId: Int? = nil) async throws -> Data? {
        if outbox.isEmpty && !path.contains("{tmp:") {
            inFlightWrites += 1
            defer { inFlightWrites -= 1 }
            do {
                return try await api.sendVoid(path, method: method, body: body)
            } catch where isOfflineError(error) {
                // Fall through and queue it.
            }
        }
        let data = try body.map { try JSONEncoder().encode($0) }
        outbox.append(PendingRequest(tripId: bundle?.trip.id ?? 0, method: method, path: path, body: data, createsTempId: createsTempId))
        OfflineStore.shared.outbox = outbox
        isOffline = !Connectivity.reachable || isOffline
        if let bundle { OfflineStore.shared.save(bundle) }
        if Connectivity.reachable { Task { await self.sync() } }
        return nil
    }

    /// Path/body reference for a row id, including rows created offline.
    private func ref(_ id: Int) async -> String? {
        if id >= 0 { return String(id) }
        if let real = await pendingCreates[id]?.value { return String(real) }
        return outbox.contains { $0.createsTempId == id } ? "{tmp:\(id)}" : nil
    }

    private func idJSON(_ id: Int) -> JSON { id < 0 ? .tempRef(id) : .int(id) }

    /// Replays changes made offline, in order, then reloads from the server.
    func sync() async {
        guard !syncing, !outbox.isEmpty, Connectivity.reachable else { return }
        syncing = true
        defer { syncing = false }
        var created: [Int: Int] = [:]
        var serverTrip: Int?
        var touchedTrips = Set<Int>()
        var rejected = 0
        while let next = outbox.first {
            var path = next.path
            var body = next.body.flatMap { String(data: $0, encoding: .utf8) }
            for (temp, real) in created {
                path = path.replacingOccurrences(of: "{tmp:\(temp)}", with: String(real))
                body = body?.replacingOccurrences(of: "\"{tmp:\(temp)}\"", with: String(real))
            }
            if path.contains("{tmp:") || body?.contains("{tmp:") == true {
                // Refers to a row whose create didn't make it; nothing to apply it to.
                outbox.removeFirst()
                OfflineStore.shared.outbox = outbox
                continue
            }
            do {
                // Each change goes to the trip it was made in.
                serverTrip = next.tripId
                var request = try await api.request(path, method: next.method, headers: ["x-trip-id": String(next.tripId)])
                if let body {
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.httpBody = Data(body.utf8)
                }
                let (data, response) = try await URLSession.shared.data(for: request)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if (200..<300).contains(status) {
                    if let temp = next.createsTempId,
                       let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let id = object["id"] as? Int {
                        created[temp] = id
                    }
                    touchedTrips.insert(next.tripId)
                } else if status >= 500 || status == 401 {
                    break // Try again later.
                } else {
                    rejected += 1 // e.g. the row was deleted on another device.
                }
                outbox.removeFirst()
                OfflineStore.shared.outbox = outbox
            } catch {
                break
            }
        }
        guard outbox.isEmpty else { return }
        if rejected > 0 { errorMessage = "\(rejected) offline change\(rejected == 1 ? "" : "s") couldn't be applied because the item changed on another device." }
        let current = bundle?.trip.id
        if Prefs.offlineMode {
            for trip in touchedTrips where trip != current {
                if let fresh: TripBundle = try? await api.send("/api/trip", headers: ["x-trip-id": String(trip)]) { OfflineStore.shared.save(fresh) }
            }
        }
        if current != nil, serverTrip != nil, !touchedTrips.isEmpty {
            if let fresh: TripBundle = try? await api.send("/api/trip") { bundle = fresh }
        }
        isOffline = false
    }

    // MARK: Helpers

    private func mutateBundle(_ change: (inout TripBundle) -> Void) {
        guard var value = bundle else { return }
        change(&value)
        bundle = value
    }

    private func mutateStops(dayId: Int, _ change: (inout [Stop]) -> Void) {
        mutateBundle { b in
            if let index = b.days.firstIndex(where: { $0.id == dayId }) { change(&b.days[index].events) }
        }
    }

    /// Optimistic change; on failure shows the error and reloads server truth.
    private func run(_ work: @escaping () async throws -> Void) async {
        do {
            try await work()
        } catch {
            errorMessage = error.localizedDescription
            await refresh()
        }
    }

    private func tempId() -> Int {
        defer {
            nextTempId -= 1
            UserDefaults.standard.set(nextTempId, forKey: "northstar.nextTempId")
        }
        return nextTempId
    }

    // MARK: Stops

    @discardableResult
    func addStop(dayId: Int, title: String, startTime: String?, category: String, location: String?, lat: Double?, lng: Double?) async -> Int? {
        guard let day = day(id: dayId) else { return nil }
        let ordered = Self.sortedStops(day.events)
        var index = ordered.count
        if let startTime, let found = ordered.firstIndex(where: { ($0.startTime ?? "") > startTime && $0.startTime != nil }) {
            index = found
        }
        let temp = tempId()
        let placeholder = Stop(id: temp, dayId: dayId, title: title, startTime: startTime.map { "\($0):00" }, endTime: nil, category: category,
                               description: nil, location: location, lat: lat.map { String($0) }, lng: lng.map { String($0) },
                               tip: nil, cost: nil, isBooked: false, sortOrder: index, updatedAt: nil)
        var next = ordered
        next.insert(placeholder, at: index)
        let reindexed = next.enumerated().map { pair -> Stop in var s = pair.element; s.sortOrder = pair.offset; return s }
        mutateStops(dayId: dayId) { $0 = reindexed }

        let task = Task<Int?, Never> {
            do {
                let response = try await self.perform("POST", "/api/events", body: [
                    "dayId": .int(dayId), "title": .string(title), "startTime": .optional(startTime), "category": .string(category),
                    "location": .optional(location), "lat": lat.map { .number($0) } ?? .null, "lng": lng.map { .number($0) } ?? .null,
                    "sortOrder": .int(index),
                ], createsTempId: temp)
                guard let response, let created = try? JSONDecoder().decode(Stop.self, from: response) else {
                    // Queued offline: keep the order locally and send it after the create.
                    if index < ordered.count { try await self.reorderRequest(reindexed.map { ($0.id, $0.sortOrder ?? 0) }) }
                    return nil
                }
                if index < ordered.count {
                    try await self.reorderRequest(reindexed.map { ($0.id == temp ? created.id : $0.id, $0.sortOrder ?? 0) })
                }
                await MainActor.run {
                    self.mutateStops(dayId: dayId) { stops in
                        if let i = stops.firstIndex(where: { $0.id == temp }) {
                            var merged = created
                            merged.sortOrder = stops[i].sortOrder
                            stops[i] = merged
                        }
                    }
                }
                return created.id
            } catch {
                await MainActor.run { self.errorMessage = error.localizedDescription }
                await self.refresh()
                return nil
            }
        }
        pendingCreates[temp] = task
        return await task.value
    }

    private func reorderRequest(_ items: [(id: Int, sortOrder: Int)]) async throws {
        let body: [String: JSON] = ["items": .array(items.map { .object(["id": idJSON($0.id), "sortOrder": .int($0.sortOrder)]) })]
        try await perform("PATCH", "/api/events/reorder", body: body)
    }

    func updateStop(_ id: Int, dayId: Int, patch: [String: JSON], apply: @escaping (inout Stop) -> Void) async {
        mutateStops(dayId: dayId) { stops in if let i = stops.firstIndex(where: { $0.id == id }) { apply(&stops[i]) } }
        await run {
            guard let ref = await self.ref(id) else { return }
            guard let data = try await self.perform("PATCH", "/api/events/\(ref)", body: patch),
                  let updated = try? JSONDecoder().decode(Stop.self, from: data) else { return }
            self.mutateStops(dayId: dayId) { stops in
                if let i = stops.firstIndex(where: { $0.id == updated.id }) { stops[i] = updated }
            }
        }
    }

    func moveStop(_ id: Int, from dayId: Int, to targetDayId: Int) async {
        var moving: Stop?
        mutateBundle { b in
            if let di = b.days.firstIndex(where: { $0.id == dayId }), let si = b.days[di].events.firstIndex(where: { $0.id == id }) {
                moving = b.days[di].events.remove(at: si)
            }
            if var stop = moving, let ti = b.days.firstIndex(where: { $0.id == targetDayId }) {
                stop.dayId = targetDayId
                stop.sortOrder = 999
                b.days[ti].events.append(stop)
            }
        }
        await run {
            guard let ref = await self.ref(id) else { return }
            try await self.perform("PATCH", "/api/events/\(ref)", body: ["dayId": .int(targetDayId), "sortOrder": .int(999)])
        }
    }

    func deleteStop(_ id: Int, dayId: Int) async {
        mutateStops(dayId: dayId) { $0.removeAll { $0.id == id } }
        await run {
            guard let ref = await self.ref(id) else { return }
            try await self.perform("DELETE", "/api/events/\(ref)")
        }
    }

    func reorderStops(dayId: Int, orderedIds: [Int]) async {
        mutateStops(dayId: dayId) { stops in
            for i in stops.indices { stops[i].sortOrder = orderedIds.firstIndex(of: stops[i].id) ?? stops[i].sortOrder }
        }
        await run { try await self.reorderRequest(orderedIds.enumerated().map { ($0.element, $0.offset) }) }
    }

    func updateDay(_ day: Day, title: String, location: String, sleep: String?, notes: String?) async {
        mutateBundle { b in
            if let i = b.days.firstIndex(where: { $0.id == day.id }) {
                b.days[i].title = title
                b.days[i].location = location
                b.days[i].sleepLocation = sleep
                b.days[i].notes = notes
            }
        }
        await run {
            try await self.perform("PUT", "/api/days/\(day.date)", body: [
                "title": .string(title), "location": .string(location), "sleepLocation": .optional(sleep), "notes": .optional(notes),
            ])
        }
    }

    // MARK: Lists

    func addReminder(_ title: String) async {
        let temp = tempId()
        mutateBundle { $0.reminders.append(Reminder(id: temp, title: title, dueDate: nil, isDone: false, dayId: nil)) }
        let task = Task<Int?, Never> {
            do {
                guard let data = try await self.perform("POST", "/api/reminders", body: ["title": .string(title)], createsTempId: temp) else { return nil }
                let created = try JSONDecoder().decode(Reminder.self, from: data)
                self.mutateBundle { b in
                    if let i = b.reminders.firstIndex(where: { $0.id == temp }) {
                        var merged = created
                        merged.isDone = b.reminders[i].isDone
                        b.reminders[i] = merged
                    }
                }
                return created.id
            } catch {
                self.errorMessage = error.localizedDescription
                await self.refresh()
                return nil
            }
        }
        pendingCreates[temp] = task
        _ = await task.value
    }

    func updateReminder(_ id: Int, patch: [String: JSON], apply: @escaping (inout Reminder) -> Void) async {
        mutateBundle { b in if let i = b.reminders.firstIndex(where: { $0.id == id }) { apply(&b.reminders[i]) } }
        await run {
            guard let ref = await self.ref(id) else { return }
            try await self.perform("PATCH", "/api/reminders/\(ref)", body: patch)
        }
    }

    func deleteReminder(_ id: Int) async {
        mutateBundle { $0.reminders.removeAll { $0.id == id } }
        await run {
            guard let ref = await self.ref(id) else { return }
            try await self.perform("DELETE", "/api/reminders/\(ref)")
        }
    }

    func addPacking(_ name: String, category: String) async {
        let temp = tempId()
        mutateBundle { $0.packingItems.append(PackingItem(id: temp, category: category, name: name, quantity: 1, isPacked: false, isEssential: false)) }
        let task = Task<Int?, Never> {
            do {
                guard let data = try await self.perform("POST", "/api/packing", body: [
                    "name": .string(name), "category": .string(category), "quantity": .int(1),
                ], createsTempId: temp) else { return nil }
                let created = try JSONDecoder().decode(PackingItem.self, from: data)
                self.mutateBundle { b in
                    if let i = b.packingItems.firstIndex(where: { $0.id == temp }) {
                        var merged = created
                        merged.isPacked = b.packingItems[i].isPacked
                        b.packingItems[i] = merged
                    }
                }
                return created.id
            } catch {
                self.errorMessage = error.localizedDescription
                await self.refresh()
                return nil
            }
        }
        pendingCreates[temp] = task
        _ = await task.value
    }

    func updatePacking(_ id: Int, patch: [String: JSON], apply: @escaping (inout PackingItem) -> Void) async {
        mutateBundle { b in if let i = b.packingItems.firstIndex(where: { $0.id == id }) { apply(&b.packingItems[i]) } }
        await run {
            guard let ref = await self.ref(id) else { return }
            try await self.perform("PATCH", "/api/packing/\(ref)", body: patch)
        }
    }

    func deletePacking(_ id: Int) async {
        mutateBundle { $0.packingItems.removeAll { $0.id == id } }
        await run {
            guard let ref = await self.ref(id) else { return }
            try await self.perform("DELETE", "/api/packing/\(ref)")
        }
    }

    // MARK: Budget

    func addExpense(_ description: String, amount: Double, category: String) async {
        let temp = tempId()
        mutateBundle { $0.expenses.append(Expense(id: temp, category: category, description: description, amount: String(amount), isBooked: false, isPaid: false, purchaseDate: nil)) }
        let task = Task<Int?, Never> {
            do {
                guard let data = try await self.perform("POST", "/api/expenses", body: [
                    "description": .string(description), "amount": .number(amount), "category": .string(category),
                ], createsTempId: temp) else { return nil }
                let created = try JSONDecoder().decode(Expense.self, from: data)
                self.mutateBundle { b in
                    if let i = b.expenses.firstIndex(where: { $0.id == temp }) {
                        var merged = created
                        merged.isPaid = b.expenses[i].isPaid
                        b.expenses[i] = merged
                    }
                }
                return created.id
            } catch {
                self.errorMessage = error.localizedDescription
                await self.refresh()
                return nil
            }
        }
        pendingCreates[temp] = task
        _ = await task.value
    }

    func updateExpense(_ id: Int, patch: [String: JSON], apply: @escaping (inout Expense) -> Void) async {
        mutateBundle { b in if let i = b.expenses.firstIndex(where: { $0.id == id }) { apply(&b.expenses[i]) } }
        await run {
            guard let ref = await self.ref(id) else { return }
            try await self.perform("PATCH", "/api/expenses/\(ref)", body: patch)
        }
    }

    func deleteExpense(_ id: Int) async {
        mutateBundle { $0.expenses.removeAll { $0.id == id } }
        await run {
            guard let ref = await self.ref(id) else { return }
            try await self.perform("DELETE", "/api/expenses/\(ref)")
        }
    }

    // MARK: Trips

    func createTrip(name: String, startDate: String, days: Int) async throws {
        guard Connectivity.reachable else { throw APIError(message: "Creating a trip needs a connection.", status: 0) }
        try await api.sendVoid("/api/trips", method: "POST", body: [
            "name": .string(String(name.prefix(80))), "destination": .string(name), "startDate": .string(startDate), "totalDays": .int(days),
        ])
        askConversationId = nil
        await refresh()
    }

    func renameTrip(_ name: String) async {
        guard let id = bundle?.trip.id else { return }
        mutateBundle { $0.trip.name = name }
        await run {
            if try await self.perform("PATCH", "/api/trips/\(id)", body: ["name": .string(name)]) != nil { await self.refresh() }
        }
    }

    func setDates(start: String, days: Int) async {
        guard Connectivity.reachable else { errorMessage = "Changing dates needs a connection."; return }
        await run {
            try await self.api.sendVoid("/api/days", method: "POST", body: ["startDate": .string(start), "totalDays": .int(days)])
            await self.refresh()
        }
    }

    func deleteTrip() async {
        guard let id = bundle?.trip.id else { return }
        guard Connectivity.reachable else { errorMessage = "Deleting a trip needs a connection."; return }
        await run {
            try await self.api.sendVoid("/api/trips/\(id)", method: "DELETE")
            self.askConversationId = nil
            await self.refresh()
        }
    }
}
