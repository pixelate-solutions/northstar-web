import Foundation
import FoundationModels

/// Whether this iPhone can run the on-device assistant, and why not if it can't.
enum OfflineAI {
    static var unavailableReason: String? {
        guard #available(iOS 26.0, *) else { return "The offline assistant needs iOS 26 or later." }
        switch SystemLanguageModel.default.availability {
        case .available: return nil
        case .unavailable(.deviceNotEligible): return "This iPhone can't run the offline assistant (it needs an Apple Intelligence iPhone)."
        case .unavailable(.appleIntelligenceNotEnabled): return "Turn on Apple Intelligence in Settings to use the offline assistant."
        case .unavailable(.modelNotReady): return "The offline assistant is still downloading to this iPhone. Try again later."
        case .unavailable: return "The offline assistant isn't available on this iPhone."
        }
    }

    static var isAvailable: Bool { unavailableReason == nil }

    static func describe(_ error: Error) -> String {
        guard #available(iOS 26.0, *) else { return error.localizedDescription }
        if let generation = error as? LanguageModelSession.GenerationError {
            switch generation {
            case .exceededContextWindowSize: return "The conversation got too long. Start a new chat."
            case .guardrailViolation, .refusal: return "It can't help with that request."
            case .assetsUnavailable: return "The on-device model isn't ready yet. Try again in a bit."
            case .rateLimited, .concurrentRequests: return "It's busy. Try again in a moment."
            default: return String(describing: generation)
            }
        }
        if let toolError = error as? LanguageModelSession.ToolCallError { return "A tool failed: \(toolError.underlyingError.localizedDescription)" }
        return error.localizedDescription
    }
}

/// Small on-device model (Apple Intelligence) with tools that read and edit the trip saved on this phone.
/// Changes go through TripStore, so they're queued and synced like any other offline edit.
@available(iOS 26.0, *)
@MainActor
final class OfflineAssistant {
    private let store: TripStore
    private var session: LanguageModelSession
    private let onStep: @MainActor (AIMessage.Step) -> Void

    init(store: TripStore, onStep: @escaping @MainActor (AIMessage.Step) -> Void) {
        self.store = store
        self.onStep = onStep
        session = Self.makeSession(store: store, onStep: onStep)
    }

    private static func makeSession(store: TripStore, onStep: @escaping @MainActor (AIMessage.Step) -> Void) -> LanguageModelSession {
        let report: @Sendable (AIMessage.Step) async -> Void = { step in await onStep(step) }
        let trip = store.bundle?.trip
        let instructions = """
        You are Northstar's offline trip assistant. The phone has no internet, so you can't look things up online.
        Trip: "\(trip?.name ?? "Trip")", \(store.days.count) days starting \(trip?.startDate ?? "soon"). Today is \(Fmt.isoDate(Date())).
        Use the tools to read the plan before answering, and to make changes the user asks for. Use 24-hour HH:mm times in tools.
        Reply in a few short sentences.
        """
        return LanguageModelSession(
            tools: [
                TripOverviewTool(store: store, report: report),
                DayDetailsTool(store: store, report: report),
                AddStopTool(store: store, report: report),
                UpdateStopTool(store: store, report: report),
                ListsTool(store: store, report: report),
                AddTodoTool(store: store, report: report),
                AddPackingTool(store: store, report: report),
                AddExpenseTool(store: store, report: report),
            ],
            instructions: instructions
        )
    }

    /// Streams the reply; `onText` gets the full text so far.
    func respond(to prompt: String, onText: @escaping (String) -> Void) async throws -> String {
        do {
            return try await stream(prompt, onText: onText)
        } catch let error as LanguageModelSession.GenerationError {
            if case .exceededContextWindowSize = error {
                // The on-device model has a small memory; start over and retry once.
                session = Self.makeSession(store: store, onStep: onStep)
                return try await stream(prompt, onText: onText)
            }
            throw error
        }
    }

    private func stream(_ prompt: String, onText: @escaping (String) -> Void) async throws -> String {
        var latest = ""
        for try await snapshot in session.streamResponse(to: prompt) {
            latest = snapshot.content
            onText(latest)
        }
        return latest
    }
}

// MARK: Tools

@available(iOS 26.0, *)
private func describe(_ stop: Stop) -> String {
    var parts = ["id \(stop.id)", stop.startTime.map { String($0.prefix(5)) } ?? "no time", stop.title, CategoryInfo.info(stop.category).label]
    if let location = stop.location, !location.isEmpty { parts.append(location) }
    if stop.booked { parts.append("booked") }
    if let cost = stop.costValue { parts.append("$\(Int(cost))") }
    if let tip = stop.tip, !tip.isEmpty { parts.append("notes: \(tip.prefix(80))") }
    return parts.joined(separator: " · ")
}

@available(iOS 26.0, *)
struct TripOverviewTool: Tool {
    let name = "trip_overview"
    let description = "List every day of the trip with its date, title, and number of stops."
    let store: TripStore
    let report: @Sendable (AIMessage.Step) async -> Void

    @Generable struct Arguments {}

    func call(arguments: Arguments) async throws -> String {
        await report(.init(kind: "tool", text: "trip_overview"))
        return await MainActor.run {
            store.days.map { "Day \($0.dayNumber) (\($0.date)): \($0.displayTitle) — \($0.events.count) stops" }.joined(separator: "\n")
        }
    }
}

@available(iOS 26.0, *)
struct DayDetailsTool: Tool {
    let name = "day_details"
    let description = "Get the stops planned for one day, in order, with their ids."
    let store: TripStore
    let report: @Sendable (AIMessage.Step) async -> Void

    @Generable struct Arguments {
        @Guide(description: "Day number, starting at 1") var dayNumber: Int
    }

    func call(arguments: Arguments) async throws -> String {
        await report(.init(kind: "tool", text: "day_details · day: \(arguments.dayNumber)"))
        return await MainActor.run {
            guard let day = store.days.first(where: { $0.dayNumber == arguments.dayNumber }) else { return "There is no Day \(arguments.dayNumber)." }
            let stops = TripStore.sortedStops(day.events).map(describe)
            return "Day \(day.dayNumber) (\(day.date)) \(day.displayTitle)\n" + (stops.isEmpty ? "No stops yet." : stops.joined(separator: "\n"))
        }
    }
}

@available(iOS 26.0, *)
struct AddStopTool: Tool {
    let name = "add_stop"
    let description = "Add a stop to a day."
    let store: TripStore
    let report: @Sendable (AIMessage.Step) async -> Void

    @Generable struct Arguments {
        @Guide(description: "Day number, starting at 1") var dayNumber: Int
        @Guide(description: "Name of the place or activity") var title: String
        @Guide(description: "Start time as HH:mm in 24-hour time, e.g. 09:00 for 9am or 19:30 for 7:30pm. Always set it when the user gives a time.") var time: String?
        @Guide(description: "One of: sightseeing, food, hike, accommodation, drive, flight, shopping, entertainment, other") var category: String
        @Guide(description: "Address or area, if known") var location: String?
    }

    func call(arguments: Arguments) async throws -> String {
        await report(.init(kind: "tool", text: "add_stop · day: \(arguments.dayNumber) · title: \(arguments.title)\(arguments.time.map { " · time: \($0)" } ?? "")"))
        let dayId = await MainActor.run { store.days.first { $0.dayNumber == arguments.dayNumber }?.id }
        guard let dayId else { return "There is no Day \(arguments.dayNumber)." }
        let time = arguments.time.flatMap(Self.normalized) ?? Fmt.timeString(Date())
        let category = CategoryInfo.all.contains { $0.value == arguments.category } ? arguments.category : CategoryInfo.guess(arguments.title)
        await store.addStop(dayId: dayId, title: arguments.title, startTime: time, category: category, location: arguments.location, lat: nil, lng: nil)
        await report(.init(kind: "result", text: "Added \(arguments.title) to Day \(arguments.dayNumber)"))
        return "Added \(arguments.title) to Day \(arguments.dayNumber)."
    }

    static func normalized(_ raw: String) -> String? {
        let parts = raw.split(separator: ":").compactMap { Int($0.prefix(2)) }
        guard parts.count >= 2, (0..<24).contains(parts[0]), (0..<60).contains(parts[1]) else { return nil }
        return String(format: "%02d:%02d", parts[0], parts[1])
    }
}

@available(iOS 26.0, *)
struct UpdateStopTool: Tool {
    let name = "update_stop"
    let description = "Change a stop's name, time, notes, cost, or booked status. Get the stop id from day_details first."
    let store: TripStore
    let report: @Sendable (AIMessage.Step) async -> Void

    @Generable struct Arguments {
        @Guide(description: "The stop id from day_details") var stopId: Int
        var title: String?
        @Guide(description: "New start time as HH:mm (24-hour)") var time: String?
        @Guide(description: "Replacement notes text") var notes: String?
        @Guide(description: "Cost in dollars") var cost: Double?
        var booked: Bool?
    }

    func call(arguments: Arguments) async throws -> String {
        await report(.init(kind: "tool", text: "update_stop · id: \(arguments.stopId)"))
        let stop = await MainActor.run { store.bundle?.days.flatMap(\.events).first { $0.id == arguments.stopId } }
        guard let stop else { return "No stop has id \(arguments.stopId)." }
        var patch: [String: JSON] = [:]
        if let title = arguments.title, !title.isEmpty { patch["title"] = .string(title) }
        if let time = arguments.time.flatMap(AddStopTool.normalized) { patch["startTime"] = .string(time) }
        if let notes = arguments.notes { patch["tip"] = .string(notes) }
        if let cost = arguments.cost { patch["cost"] = .number(cost) }
        if let booked = arguments.booked { patch["isBooked"] = .bool(booked) }
        guard !patch.isEmpty else { return "Nothing to change." }
        let args = arguments
        await store.updateStop(stop.id, dayId: stop.dayId, patch: patch) { s in
            if let title = args.title, !title.isEmpty { s.title = title }
            if let time = args.time.flatMap(AddStopTool.normalized) { s.startTime = "\(time):00" }
            if let notes = args.notes { s.tip = notes }
            if let cost = args.cost { s.cost = String(cost) }
            if let booked = args.booked { s.isBooked = booked }
        }
        await report(.init(kind: "result", text: "Updated \(stop.title)"))
        return "Updated \(stop.title)."
    }
}

@available(iOS 26.0, *)
struct ListsTool: Tool {
    let name = "lists"
    let description = "Read the to-do list, packing list, and budget."
    let store: TripStore
    let report: @Sendable (AIMessage.Step) async -> Void

    @Generable struct Arguments {}

    func call(arguments: Arguments) async throws -> String {
        await report(.init(kind: "tool", text: "lists"))
        return await MainActor.run {
            guard let bundle = store.bundle else { return "No trip loaded." }
            let todos = bundle.reminders.map { "\(($0.isDone ?? false) ? "[x]" : "[ ]") \($0.title)" }
            let packing = bundle.packingItems.map { "\(($0.isPacked ?? false) ? "[x]" : "[ ]") \($0.name)" }
            let total = bundle.expenses.reduce(0) { $0 + $1.amountValue }
            return "To do:\n\(todos.joined(separator: "\n"))\n\nPacking:\n\(packing.joined(separator: "\n"))\n\nBudget total: $\(Int(total)) across \(bundle.expenses.count) expenses."
        }
    }
}

@available(iOS 26.0, *)
struct AddTodoTool: Tool {
    let name = "add_todo"
    let description = "Add a task to the to-do list (things to book, buy, or do before the trip)."
    let store: TripStore
    let report: @Sendable (AIMessage.Step) async -> Void

    @Generable struct Arguments {
        @Guide(description: "The task, e.g. Buy a rail pass") var task: String
    }

    func call(arguments: Arguments) async throws -> String {
        await report(.init(kind: "tool", text: "add_todo · \(arguments.task)"))
        await store.addReminder(arguments.task)
        return "Added \(arguments.task) to the to-do list."
    }
}

@available(iOS 26.0, *)
struct AddPackingTool: Tool {
    let name = "add_packing_item"
    let description = "Add an item to bring to the packing list (clothes, gear, documents)."
    let store: TripStore
    let report: @Sendable (AIMessage.Step) async -> Void

    @Generable struct Arguments {
        @Guide(description: "The item to pack, e.g. Rain jacket") var item: String
    }

    func call(arguments: Arguments) async throws -> String {
        await report(.init(kind: "tool", text: "add_packing_item · \(arguments.item)"))
        await store.addPacking(arguments.item, category: "other")
        return "Added \(arguments.item) to the packing list."
    }
}

@available(iOS 26.0, *)
struct AddExpenseTool: Tool {
    let name = "add_expense"
    let description = "Add an expense to the budget."
    let store: TripStore
    let report: @Sendable (AIMessage.Step) async -> Void

    @Generable struct Arguments {
        var description: String
        @Guide(description: "Amount in dollars") var amount: Double
        @Guide(description: "Stays, Food, Car & gas, Flights, Activities, or Other") var category: String
    }

    func call(arguments: Arguments) async throws -> String {
        await report(.init(kind: "tool", text: "add_expense · \(arguments.description) · $\(arguments.amount)"))
        await store.addExpense(arguments.description, amount: arguments.amount, category: arguments.category)
        return "Added \(arguments.description) for $\(arguments.amount)."
    }
}

