import Foundation
import Observation

@Observable
@MainActor
final class TripStore {
    var bundle: TripBundle?
    var trips: [TripSummary] = []
    var userName = ""
    var isLoading = false
    var errorMessage: String?
    var highlightedStopIds: Set<Int> = []
    var askConversationId: Int?

    private let api = APIClient.shared
    private var nextTempId = -1
    private var pendingCreates: [Int: Task<Int?, Never>] = [:]

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
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func refresh() async {
        do {
            bundle = try await api.send("/api/trip")
            let me: Me = try await api.send("/api/me")
            trips = me.trips
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
        } catch {
            errorMessage = error.localizedDescription
        }
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

    private func resolve(_ id: Int) async -> Int? {
        if id >= 0 { return id }
        return await pendingCreates[id]?.value
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
        defer { nextTempId -= 1 }
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

        let task = Task<Int?, Never> { [api] in
            do {
                let created: Stop = try await api.send("/api/events", method: "POST", body: [
                    "dayId": .int(dayId), "title": .string(title), "startTime": .optional(startTime), "category": .string(category),
                    "location": .optional(location), "lat": lat.map { .number($0) } ?? .null, "lng": lng.map { .number($0) } ?? .null,
                    "sortOrder": .int(index),
                ])
                if index < ordered.count {
                    let items = reindexed.map { ["id": $0.id == temp ? created.id : $0.id, "sortOrder": $0.sortOrder ?? 0] }
                    try await self.reorderRequest(items)
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

    private nonisolated func reorderRequest(_ items: [[String: Int]]) async throws {
        var request = try await APIClient.shared.request("/api/events/reorder", method: "PATCH")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["items": items])
        let (_, response) = try await URLSession.shared.data(for: request)
        guard ((response as? HTTPURLResponse)?.statusCode ?? 0) < 300 else { throw APIError(message: "Couldn't reorder stops.", status: 0) }
    }

    func updateStop(_ id: Int, dayId: Int, patch: [String: JSON], apply: @escaping (inout Stop) -> Void) async {
        mutateStops(dayId: dayId) { stops in if let i = stops.firstIndex(where: { $0.id == id }) { apply(&stops[i]) } }
        await run {
            guard let realId = await self.resolve(id) else { return }
            let updated: Stop = try await self.api.send("/api/events/\(realId)", method: "PATCH", body: patch)
            self.mutateStops(dayId: dayId) { stops in
                if let i = stops.firstIndex(where: { $0.id == realId }) { stops[i] = updated }
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
            guard let realId = await self.resolve(id) else { return }
            try await self.api.sendVoid("/api/events/\(realId)", method: "PATCH", body: ["dayId": .int(targetDayId), "sortOrder": .int(999)])
        }
    }

    func deleteStop(_ id: Int, dayId: Int) async {
        mutateStops(dayId: dayId) { $0.removeAll { $0.id == id } }
        await run {
            guard let realId = await self.resolve(id) else { return }
            try await self.api.sendVoid("/api/events/\(realId)", method: "DELETE")
        }
    }

    func reorderStops(dayId: Int, orderedIds: [Int]) async {
        mutateStops(dayId: dayId) { stops in
            for i in stops.indices { stops[i].sortOrder = orderedIds.firstIndex(of: stops[i].id) ?? stops[i].sortOrder }
        }
        let real = orderedIds.filter { $0 > 0 }
        await run { try await self.reorderRequest(real.enumerated().map { ["id": $0.element, "sortOrder": $0.offset] }) }
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
            try await self.api.sendVoid("/api/days/\(day.date)", method: "PUT", body: [
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
                let created: Reminder = try await self.api.send("/api/reminders", method: "POST", body: ["title": .string(title)])
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
            guard let realId = await self.resolve(id) else { return }
            try await self.api.sendVoid("/api/reminders/\(realId)", method: "PATCH", body: patch)
        }
    }

    func deleteReminder(_ id: Int) async {
        mutateBundle { $0.reminders.removeAll { $0.id == id } }
        await run {
            guard let realId = await self.resolve(id) else { return }
            try await self.api.sendVoid("/api/reminders/\(realId)", method: "DELETE")
        }
    }

    func addPacking(_ name: String, category: String) async {
        let temp = tempId()
        mutateBundle { $0.packingItems.append(PackingItem(id: temp, category: category, name: name, quantity: 1, isPacked: false, isEssential: false)) }
        let task = Task<Int?, Never> {
            do {
                let created: PackingItem = try await self.api.send("/api/packing", method: "POST", body: [
                    "name": .string(name), "category": .string(category), "quantity": .int(1),
                ])
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
            guard let realId = await self.resolve(id) else { return }
            try await self.api.sendVoid("/api/packing/\(realId)", method: "PATCH", body: patch)
        }
    }

    func deletePacking(_ id: Int) async {
        mutateBundle { $0.packingItems.removeAll { $0.id == id } }
        await run {
            guard let realId = await self.resolve(id) else { return }
            try await self.api.sendVoid("/api/packing/\(realId)", method: "DELETE")
        }
    }

    // MARK: Budget

    func addExpense(_ description: String, amount: Double, category: String) async {
        let temp = tempId()
        mutateBundle { $0.expenses.append(Expense(id: temp, category: category, description: description, amount: String(amount), isBooked: false, isPaid: false, purchaseDate: nil)) }
        let task = Task<Int?, Never> {
            do {
                let created: Expense = try await self.api.send("/api/expenses", method: "POST", body: [
                    "description": .string(description), "amount": .number(amount), "category": .string(category),
                ])
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
            guard let realId = await self.resolve(id) else { return }
            try await self.api.sendVoid("/api/expenses/\(realId)", method: "PATCH", body: patch)
        }
    }

    func deleteExpense(_ id: Int) async {
        mutateBundle { $0.expenses.removeAll { $0.id == id } }
        await run {
            guard let realId = await self.resolve(id) else { return }
            try await self.api.sendVoid("/api/expenses/\(realId)", method: "DELETE")
        }
    }

    // MARK: Trips

    func createTrip(name: String, startDate: String, days: Int) async throws {
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
            try await self.api.sendVoid("/api/trips/\(id)", method: "PATCH", body: ["name": .string(name)])
            await self.refresh()
        }
    }

    func setDates(start: String, days: Int) async {
        await run {
            try await self.api.sendVoid("/api/days", method: "POST", body: ["startDate": .string(start), "totalDays": .int(days)])
            await self.refresh()
        }
    }

    func deleteTrip() async {
        guard let id = bundle?.trip.id else { return }
        await run {
            try await self.api.sendVoid("/api/trips/\(id)", method: "DELETE")
            self.askConversationId = nil
            await self.refresh()
        }
    }
}
