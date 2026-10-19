import CoreLocation
import Foundation
import MapKit
import Network
import Observation

// MARK: Connectivity

/// Whether the device can reach the network. `-NorthstarForceOffline YES` simulates no connection (UI tests).
@Observable
@MainActor
final class Connectivity {
    static let shared = Connectivity()
    nonisolated static let forcedOffline = UserDefaults.standard.bool(forKey: "NorthstarForceOffline")
    /// Mirror of `isOnline` readable off the main actor (lets requests fail fast instead of timing out).
    nonisolated(unsafe) static var reachable = true

    private(set) var isOnline = true
    private let monitor = NWPathMonitor()

    private init() {
        isOnline = !Self.forcedOffline
        Self.reachable = isOnline
        monitor.pathUpdateHandler = { path in
            let online = path.status == .satisfied && !Connectivity.forcedOffline
            Connectivity.reachable = online
            Task { @MainActor in
                let cameBack = online && !Connectivity.shared.isOnline
                Connectivity.shared.isOnline = online
                if cameBack { NotificationCenter.default.post(name: .northstarBackOnline, object: nil) }
            }
        }
        monitor.start(queue: DispatchQueue(label: "northstar.connectivity"))
    }
}

extension Notification.Name {
    static let northstarBackOnline = Notification.Name("northstarBackOnline")
}

/// True for failures caused by having no connection (as opposed to the server rejecting a request).
@MainActor
func isOfflineError(_ error: Error) -> Bool {
    if error is APIError { return false }
    if let url = error as? URLError {
        switch url.code {
        case .notConnectedToInternet, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed,
             .timedOut, .internationalRoamingOff, .dataNotAllowed, .secureConnectionFailed:
            return true
        default:
            return false
        }
    }
    // Token refresh and other SDK calls fail with their own error types when offline.
    return !Connectivity.shared.isOnline
}

// MARK: Queued changes

/// A write made while offline, replayed in order when the connection returns.
/// Ids of rows created offline appear as `{tmp:-3}` in the path and as the JSON string "{tmp:-3}" in the body.
struct PendingRequest: Codable, Identifiable {
    var id = UUID()
    let tripId: Int
    let method: String
    let path: String
    let body: Data?
    /// For creates: the temporary id the new row has locally.
    let createsTempId: Int?
}

// MARK: Disk

/// Trip data saved on the device: every trip bundle, the trip list, queued changes, routes and the avatar.
@MainActor
final class OfflineStore {
    static let shared = OfflineStore()

    private let root: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let url = base.appending(path: "Offline", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }()

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private func url(_ name: String) -> URL { root.appending(path: name) }

    private func write<T: Encodable>(_ value: T, to name: String) {
        guard let data = try? encoder.encode(value) else { return }
        try? data.write(to: url(name), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    private func read<T: Decodable>(_ type: T.Type, from name: String) -> T? {
        guard let data = try? Data(contentsOf: url(name)) else { return nil }
        return try? decoder.decode(T.self, from: data)
    }

    // Bundles

    func save(_ bundle: TripBundle) { write(bundle, to: "trip-\(bundle.trip.id).json") }
    func bundle(tripId: Int) -> TripBundle? { read(TripBundle.self, from: "trip-\(tripId).json") }

    func save(_ me: Me) { write(me, to: "me.json") }
    var me: Me? { read(Me.self, from: "me.json") }

    var hasData: Bool { me != nil }

    // Outbox

    var outbox: [PendingRequest] {
        get { read([PendingRequest].self, from: "outbox.json") ?? [] }
        set { write(newValue, to: "outbox.json") }
    }

    // Routes

    struct SavedRoute: Codable {
        let from: Int, to: Int
        let duration: Double, distance: Double
        let coordinates: [[Double]]
    }

    var routes: [String: SavedRoute] {
        get { read([String: SavedRoute].self, from: "routes.json") ?? [:] }
        set { write(newValue, to: "routes.json") }
    }

    // Avatar

    var avatar: Data? { try? Data(contentsOf: url("avatar.jpg")) }
    func saveAvatar(_ data: Data?) {
        if let data { try? data.write(to: url("avatar.jpg"), options: .atomic) } else { try? FileManager.default.removeItem(at: url("avatar.jpg")) }
    }

    // Housekeeping

    var sizeOnDisk: Int64 {
        let files = (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: [.fileSizeKey])) ?? []
        return files.reduce(0) { $0 + Int64((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
    }

    /// Removes saved trips and routes. Queued changes are kept so nothing typed offline is lost.
    func removeDownloads() {
        let files = (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? []
        for file in files where file.lastPathComponent != "outbox.json" { try? FileManager.default.removeItem(at: file) }
    }
}

// MARK: Download for offline

/// Saves every trip, its routes, and the map around each stop so the app works without a connection.
@Observable
@MainActor
final class OfflineDownloader {
    static let shared = OfflineDownloader()

    private(set) var progress: Double?
    private(set) var lastError: String?
    /// What's saved so far vs. what needs saving, per kind.
    private(set) var trips = (done: 0, total: 0)
    private(set) var routes = (done: 0, total: 0)
    private(set) var maps = (done: 0, total: 0)
    /// When everything last finished saving.
    var completedAt: Date? {
        get { UserDefaults.standard.object(forKey: "northstar.offlineSavedAt") as? Date }
        set { UserDefaults.standard.set(newValue, forKey: "northstar.offlineSavedAt") }
    }

    var isRunning: Bool { progress != nil }

    func run(store: TripStore) async {
        guard progress == nil else { return }
        progress = 0
        lastError = nil
        trips = (0, 0); routes = (0, 0); maps = (0, 0)
        defer { progress = nil }
        do {
            let api = APIClient.shared
            let me: Me = try await api.send("/api/me")
            OfflineStore.shared.save(me)
            let activeId = store.bundle?.trip.id ?? me.activeTripId
            // Fetching a trip makes it the active one on the server, so finish on the current trip.
            let ordered = me.trips.map(\.id).filter { $0 != activeId } + [activeId]
            var bundles: [TripBundle] = []
            trips = (0, ordered.count)
            for (index, id) in ordered.enumerated() {
                let bundle: TripBundle = try await api.send("/api/trip", headers: ["x-trip-id": String(id)])
                OfflineStore.shared.save(bundle)
                bundles.append(bundle)
                trips.done = index + 1
                progress = 0.25 * Double(index + 1) / Double(ordered.count)
            }

            // Driving routes between stops, day by day.
            let routeJobs = bundles.flatMap(\.days).map { day in
                TripStore.sortedStops(day.events).compactMap { stop -> (id: Int, coordinate: CLLocationCoordinate2D)? in
                    guard stop.hasCoordinates, let lat = stop.latitude, let lng = stop.longitude else { return nil }
                    return (stop.id, CLLocationCoordinate2D(latitude: lat, longitude: lng))
                }
            }
            routes = (0, routeJobs.reduce(0) { $0 + max(0, $1.count - 1) })
            await RouteService.shared.prefetch(routeJobs) { done in
                self.routes.done = Int((Double(self.routes.total) * done).rounded())
                self.progress = 0.25 + 0.35 * done
            }

            // Map tiles: render each day and each stop so MapKit caches them.
            var seen = Set<String>()
            let regions = bundles.flatMap(\.days).flatMap(Self.regions(for:)).filter { region in
                // Skip near-duplicates (same spot, same zoom).
                let key = String(format: "%.2f,%.2f,%.3f", region.center.latitude, region.center.longitude, region.span.latitudeDelta)
                return seen.insert(key).inserted
            }
            maps = (0, regions.count)
            var next = 0
            await withTaskGroup(of: Void.self) { group in
                func enqueue() {
                    guard next < regions.count else { return }
                    let region = regions[next]
                    next += 1
                    group.addTask { await Self.warm(region) }
                }
                for _ in 0..<4 { enqueue() }
                while await group.next() != nil {
                    maps.done += 1
                    progress = 0.6 + 0.4 * Double(maps.done) / Double(max(regions.count, 1))
                    enqueue()
                }
            }
            if let current = bundles.last { store.adoptDownloaded(current, me: me) }
            completedAt = Date()
        } catch {
            lastError = isOfflineError(error) ? "No connection. Try again when you're online." : error.localizedDescription
        }
    }

    nonisolated private static func regions(for day: Day) -> [MKCoordinateRegion] {
        let coords = day.events.compactMap { stop -> CLLocationCoordinate2D? in
            guard stop.hasCoordinates, let lat = stop.latitude, let lng = stop.longitude else { return nil }
            return .init(latitude: lat, longitude: lng)
        }
        guard !coords.isEmpty else { return [] }
        let lats = coords.map(\.latitude), lngs = coords.map(\.longitude)
        let center = CLLocationCoordinate2D(latitude: (lats.min()! + lats.max()!) / 2, longitude: (lngs.min()! + lngs.max()!) / 2)
        let span = MKCoordinateSpan(latitudeDelta: max(0.02, (lats.max()! - lats.min()!) * 1.4), longitudeDelta: max(0.02, (lngs.max()! - lngs.min()!) * 1.4))
        var regions = [MKCoordinateRegion(center: center, span: span)]
        // Close-ups around each stop (street level) and a middle zoom.
        for coord in coords {
            regions.append(MKCoordinateRegion(center: coord, latitudinalMeters: 1_500, longitudinalMeters: 1_500))
            regions.append(MKCoordinateRegion(center: coord, latitudinalMeters: 10_000, longitudinalMeters: 10_000))
        }
        return regions
    }

    nonisolated private static func warm(_ region: MKCoordinateRegion) async {
        let options = MKMapSnapshotter.Options()
        options.region = region
        options.size = CGSize(width: 800, height: 800)
        let configuration = MKStandardMapConfiguration(elevationStyle: .flat, emphasisStyle: .muted)
        configuration.pointOfInterestFilter = .excludingAll
        options.preferredConfiguration = configuration
        _ = try? await MKMapSnapshotter(options: options).start()
    }
}
