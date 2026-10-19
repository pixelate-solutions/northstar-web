import Foundation

enum TripRole: String, Codable { case owner, collaborator, viewer }

struct Trip: Codable, Identifiable, Hashable {
    let id: Int
    var name: String
    var destination: String?
    var startDate: String?
    var endDate: String?
}

struct Stop: Codable, Identifiable, Hashable {
    var id: Int
    var dayId: Int
    var title: String
    var startTime: String?
    var endTime: String?
    var category: String
    var description: String?
    var location: String?
    var lat: String?
    var lng: String?
    var tip: String?
    var cost: String?
    var isBooked: Bool?
    var sortOrder: Int?
    var updatedAt: String?

    var latitude: Double? { lat.flatMap(Double.init) }
    var longitude: Double? { lng.flatMap(Double.init) }
    var hasCoordinates: Bool {
        guard let la = latitude, let lo = longitude else { return false }
        return !(la == 0 && lo == 0)
    }
    var costValue: Double? { cost.flatMap(Double.init).flatMap { $0 > 0 ? $0 : nil } }
    var booked: Bool { isBooked ?? false }
}

struct Pin: Codable, Identifiable, Hashable {
    let id: Int
    var name: String
    var lat: String
    var lng: String
}

struct Day: Codable, Identifiable, Hashable {
    let id: Int
    var date: String
    var dayNumber: Int
    var title: String
    var location: String
    var sleepLocation: String?
    var driveInfo: String?
    var notes: String?
    var events: [Stop]
    var locations: [Pin]

    var displayTitle: String {
        if !title.isEmpty { return title }
        if !location.isEmpty { return location }
        return "Day \(dayNumber)"
    }
}

struct PackingItem: Codable, Identifiable, Hashable {
    var id: Int
    var category: String
    var name: String
    var quantity: Int?
    var isPacked: Bool?
    var isEssential: Bool?
}

struct Expense: Codable, Identifiable, Hashable {
    var id: Int
    var category: String
    var description: String
    var amount: String
    var isBooked: Bool?
    var isPaid: Bool?
    var purchaseDate: String?
    var amountValue: Double { Double(amount) ?? 0 }
}

struct Reminder: Codable, Identifiable, Hashable {
    var id: Int
    var title: String
    var dueDate: String?
    var isDone: Bool?
    var dayId: Int?
}

struct TripBundle: Codable {
    var trip: Trip
    var role: TripRole
    var days: [Day]
    var packingItems: [PackingItem]
    var expenses: [Expense]
    var reminders: [Reminder]
}

struct TripSummary: Codable, Identifiable, Hashable {
    let id: Int
    var name: String
    var destination: String?
    var startDate: String?
    var endDate: String?
    var role: TripRole
}

struct Me: Codable {
    struct User: Codable { let id: Int; let name: String; let email: String? }
    let user: User
    let activeTripId: Int
    let trips: [TripSummary]
}

struct Member: Codable, Identifiable, Hashable {
    var membershipId: Int?
    var userId: Int
    var email: String?
    var fullName: String?
    var role: TripRole
    var isOwner: Bool
    var id: Int { userId }
}

// MARK: AI

struct AICard: Codable, Hashable {
    let type: String
    let title: String?
    let changes: [String]?
}

struct AIMessage: Codable, Identifiable, Hashable {
    struct Source: Codable, Hashable { let url: String; let title: String }
    struct Step: Codable, Hashable { let kind: String; let text: String }
    struct Attachment: Codable, Hashable { let filename: String; var mimeType: String?; var kind: String? }
    struct Metadata: Codable, Hashable {
        var undoable: Bool?
        var undoApplied: Bool?
        var sources: [Source]?
        var steps: [Step]?
        var thoughtMs: Double?
        /// Answered by the on-device model while offline (not saved to the server).
        var onDevice: Bool?
        /// Photos and files sent with a user message.
        var attachments: [Attachment]?
    }
    var id: Int
    var role: String
    var content: String
    var cards: [AICard]
    var followups: [String]
    var metadata: Metadata?
}

struct AIConversation: Codable, Identifiable, Hashable {
    let id: Int
    let title: String
    let updatedAt: String
}
