import CoreLocation
import MapKit
import Observation

struct RouteLeg: Hashable {
    let from: Int
    let to: Int
    let duration: TimeInterval
    let distance: CLLocationDistance
}

/// Driving directions between consecutive located stops, via Apple Maps. Cached per coordinate pair.
@Observable
@MainActor
final class RouteService {
    static let shared = RouteService()

    private(set) var legs: [String: RouteLeg] = [:]
    private(set) var polylines: [String: MKPolyline] = [:]
    private var inFlight: Set<String> = []

    init() {
        // Routes saved for offline use.
        for (key, saved) in OfflineStore.shared.routes {
            legs[key] = RouteLeg(from: saved.from, to: saved.to, duration: saved.duration, distance: saved.distance)
            let coords = saved.coordinates.map { CLLocationCoordinate2D(latitude: $0[0], longitude: $0[1]) }
            polylines[key] = MKPolyline(coordinates: coords, count: coords.count)
        }
    }

    /// Fetches every leg for several stop sequences and waits until done (used when saving for offline).
    func prefetch(_ sequences: [[(id: Int, coordinate: CLLocationCoordinate2D)]], progress: @escaping (Double) -> Void) async {
        for sequence in sequences { ensure(sequence) }
        let total = max(1, queue.count)
        while draining || !queue.isEmpty {
            progress(1 - Double(queue.count) / Double(total))
            try? await Task.sleep(for: .milliseconds(300))
        }
        progress(1)
        persist()
    }

    private func persist() {
        var saved: [String: OfflineStore.SavedRoute] = [:]
        for (key, leg) in legs {
            guard let line = polylines[key] else { continue }
            var coords = [CLLocationCoordinate2D](repeating: .init(), count: line.pointCount)
            line.getCoordinates(&coords, range: NSRange(location: 0, length: line.pointCount))
            saved[key] = .init(from: leg.from, to: leg.to, duration: leg.duration, distance: leg.distance, coordinates: coords.map { [$0.latitude, $0.longitude] })
        }
        OfflineStore.shared.routes = saved
    }

    static func key(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> String {
        String(format: "%.5f,%.5f>%.5f,%.5f", a.latitude, a.longitude, b.latitude, b.longitude)
    }

    func leg(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> RouteLeg? { legs[Self.key(a, b)] }
    func polyline(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> MKPolyline? { polylines[Self.key(a, b)] }

    private var queue: [(key: String, from: (id: Int, coordinate: CLLocationCoordinate2D), to: (id: Int, coordinate: CLLocationCoordinate2D))] = []
    private var draining = false

    /// Queues every missing leg. Requests run one at a time so MapKit doesn't throttle later legs.
    func ensure(_ points: [(id: Int, coordinate: CLLocationCoordinate2D)]) {
        guard points.count > 1 else { return }
        for i in 0..<(points.count - 1) {
            let a = points[i], b = points[i + 1]
            let key = Self.key(a.coordinate, b.coordinate)
            if legs[key] != nil || inFlight.contains(key) { continue }
            // Skip absurd legs (e.g. a flight home) — MapKit can't drive them anyway.
            if CLLocation(latitude: a.coordinate.latitude, longitude: a.coordinate.longitude)
                .distance(from: CLLocation(latitude: b.coordinate.latitude, longitude: b.coordinate.longitude)) > 1_500_000 { continue }
            inFlight.insert(key)
            queue.append((key, a, b))
        }
        drain()
    }

    private func drain() {
        guard !draining else { return }
        draining = true
        Task {
            while !queue.isEmpty {
                let job = queue.removeFirst()
                var attempt = 0
                while attempt < 3 {
                    let request = MKDirections.Request()
                    request.source = MKMapItem(placemark: MKPlacemark(coordinate: job.from.coordinate))
                    request.destination = MKMapItem(placemark: MKPlacemark(coordinate: job.to.coordinate))
                    request.transportType = .automobile
                    do {
                        if let route = try await MKDirections(request: request).calculate().routes.first {
                            legs[job.key] = RouteLeg(from: job.from.id, to: job.to.id, duration: route.expectedTravelTime, distance: route.distance)
                            polylines[job.key] = route.polyline
                        }
                        break
                    } catch let error as MKError where error.code == .loadingThrottled {
                        attempt += 1
                        try? await Task.sleep(for: .seconds(Double(attempt) * 3))
                    } catch {
                        break
                    }
                }
                inFlight.remove(job.key)
            }
            draining = false
            if UserDefaults.standard.bool(forKey: Prefs.offlineModeKey) { persist() }
        }
    }
}

struct PlaceSuggestion: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let subtitle: String
    let completion: MKLocalSearchCompletion?
}

struct ResolvedPlace {
    let name: String
    let address: String
    let coordinate: CLLocationCoordinate2D
}

/// Apple Maps autocomplete for adding stops.
@Observable
@MainActor
final class PlaceSearch: NSObject, MKLocalSearchCompleterDelegate {
    var query = "" {
        didSet { completer.queryFragment = query.trimmingCharacters(in: .whitespaces) }
    }
    private(set) var suggestions: [PlaceSuggestion] = []
    private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        if #available(iOS 18.0, *) {
            completer.resultTypes = [.pointOfInterest, .address, .physicalFeature, .query]
        } else {
            completer.resultTypes = [.pointOfInterest, .address, .query]
        }
    }

    func bias(to coordinate: CLLocationCoordinate2D?) {
        guard let coordinate else { return }
        completer.region = MKCoordinateRegion(center: coordinate, latitudinalMeters: 60_000, longitudinalMeters: 60_000)
    }

    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        let results = completer.results.prefix(8).map { PlaceSuggestion(title: $0.title, subtitle: $0.subtitle, completion: $0) }
        Task { @MainActor in self.suggestions = Array(results) }
    }

    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        Task { @MainActor in self.suggestions = [] }
    }

    private var region: MKCoordinateRegion? { completer.region.span.latitudeDelta > 0 && completer.region.span.latitudeDelta < 100 ? completer.region : nil }

    /// Resolves an autocomplete row to a coordinate; falls back to a full-text Apple Maps search.
    func resolve(_ suggestion: PlaceSuggestion) async -> ResolvedPlace? {
        if let completion = suggestion.completion,
           let item = try? await MKLocalSearch(request: MKLocalSearch.Request(completion: completion)).start().mapItems.first {
            return place(from: item, fallbackName: suggestion.title, subtitle: suggestion.subtitle)
        }
        return await search([suggestion.title, suggestion.subtitle].filter { !$0.isEmpty }.joined(separator: ", "))
    }

    /// Full-text Apple Maps search (used when the user submits typed text).
    func search(_ text: String) async -> ResolvedPlace? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = trimmed
        if let region { request.region = region }
        if let item = try? await MKLocalSearch(request: request).start().mapItems.first {
            return place(from: item, fallbackName: trimmed, subtitle: "")
        }
        if let placemark = try? await CLGeocoder().geocodeAddressString(trimmed).first, let location = placemark.location {
            let address = [placemark.locality, placemark.administrativeArea, placemark.country].compactMap { $0 }.joined(separator: ", ")
            return ResolvedPlace(name: placemark.name ?? trimmed, address: address, coordinate: location.coordinate)
        }
        return nil
    }

    private func place(from item: MKMapItem, fallbackName: String, subtitle: String) -> ResolvedPlace {
        let name = item.name ?? fallbackName
        var address = subtitle.isEmpty ? (item.placemark.title ?? "") : subtitle
        if address == name { address = "" }
        return ResolvedPlace(name: name, address: address, coordinate: item.placemark.coordinate)
    }
}

enum CategoryInfo {
    static let all: [(value: String, label: String, symbol: String)] = [
        ("sightseeing", "View", "eye"),
        ("food", "Food", "fork.knife"),
        ("hike", "Hike", "mountain.2"),
        ("accommodation", "Stay", "bed.double"),
        ("drive", "Drive", "car"),
        ("flight", "Flight", "airplane"),
        ("shopping", "Shop", "bag"),
        ("entertainment", "Fun", "ticket"),
        ("other", "Other", "mappin"),
    ]

    static func info(_ value: String) -> (value: String, label: String, symbol: String) {
        all.first { $0.value == value } ?? all[all.count - 1]
    }

    static func guess(_ text: String) -> String {
        let t = text.lowercased()
        let rules: [(String, [String])] = [
            ("food", ["cafe", "café", "coffee", "restaurant", "diner", "grill", "bakery", "pizza", "taco", "bar ", "brewery", "breakfast", "lunch", "dinner"]),
            ("hike", ["trail", "hike", "trailhead", "summit", "peak", "loop"]),
            ("accommodation", ["hotel", "inn", "lodge", "motel", "resort", "airbnb", "cabin", "campground", "hostel", "suites"]),
            ("flight", ["airport", "flight", "terminal"]),
            ("sightseeing", ["point", "overlook", "viewpoint", "vista", "museum", "monument", "park", "arch", "falls", "lake", "beach"]),
            ("shopping", ["shop", "market", "mall", "store", "outlet"]),
        ]
        return rules.first { rule in rule.1.contains { t.contains($0) } }?.0 ?? "other"
    }
}
